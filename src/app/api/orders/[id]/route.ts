import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { sendEmail } from "@/lib/mail/nodemailer";
import {
  getOrderStatusSubject,
  getOrderStatusTone,
  renderOrderStatusEmail,
} from "@/lib/mail/templates";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

type OrderEmailItem = {
  name: string;
  quantity: number;
  price: number;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const body = await req.json();
    const { fulfillmentStatus, trackingNumber } = body;
    const trimmedTrackingNumber =
      typeof trackingNumber === "string" ? trackingNumber.trim() : "";

    const allowedStatuses = ["unfulfilled", "fulfilled", "shipped", "completed"];

    if (!fulfillmentStatus) {
      return NextResponse.json(
        { error: "Missing fulfillment status" },
        { status: 400 }
      );
    }
    if (!allowedStatuses.includes(fulfillmentStatus)) {
      return NextResponse.json(
        { error: "Invalid fulfillment status value" },
        { status: 400 }
      );
    }
    if (
      fulfillmentStatus === "shipped" &&
      !trimmedTrackingNumber
    ) {
      return NextResponse.json(
        { error: "Waybill number is required when marking as shipped" },
        { status: 400 }
      );
    }

    const { id } = await params;

    const updateData: Record<string, unknown> = {
      fulfillmentStatus,
      updatedAt: new Date(),
    };

    if (fulfillmentStatus === "shipped") {
      updateData.trackingNumber = trimmedTrackingNumber;
      updateData.shippedAt = new Date();
    }

    if (fulfillmentStatus === "completed") {
      updateData.deliveredAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return NextResponse.json(
        { error: `Order not found for id ${id}` },
        { status: 404 }
      );
    }

    // ✅ Use billingDetails.email directly — works for both registered and guest users
    const recipientEmail = order.billingDetails.email;
    const recipientName = order.billingDetails.firstName;

    if (recipientEmail) {
      const formattedOrderId = order._id.toString().slice(-6).toUpperCase();
      const subscriptionLookupConditions: Array<{
        orderId?: typeof order._id;
        _id?: typeof order._id;
      }> = [{ orderId: order._id }];

      if (order.subscription) {
        subscriptionLookupConditions.push({ _id: order.subscription });
      }

      const linkedSubscription =
        order.orderType === "subscription"
          ? await Subscription.findOne({
              $or: subscriptionLookupConditions,
            })
              .select("subscriptionId")
              .lean()
          : null;
      const subscriptionId = linkedSubscription?.subscriptionId || null;
      const isSubscriptionOrder = order.orderType === "subscription" || Boolean(subscriptionId);

      let message = "Your order status has been updated.";
      if (fulfillmentStatus === "fulfilled") {
        message = `Hi ${recipientName}, your order has been packed and is ready for shipment.`;
      } else if (fulfillmentStatus === "shipped") {
        message = `Hi ${recipientName}, your order is now on its way.`;
      } else if (fulfillmentStatus === "completed") {
        message = `Hi ${recipientName}, your order has been delivered successfully.`;
      }

      try {
        await sendEmail({
          to: recipientEmail,
          subject: getOrderStatusSubject({
            orderCode: formattedOrderId,
            status: fulfillmentStatus,
            isSubscriptionOrder,
          }),
          html: renderOrderStatusEmail({
            eyebrow: isSubscriptionOrder ? "Subscription Order" : "Order Update",
            title:
              isSubscriptionOrder && fulfillmentStatus === "fulfilled"
                ? "Order confirmed"
                : "Order update",
            lead:
              isSubscriptionOrder && fulfillmentStatus === "fulfilled"
                ? "Thank you for your order. Your payment has been confirmed and we are now processing it."
                : message,
            orderCode: formattedOrderId,
            statusLabel: fulfillmentStatus,
            statusTone: getOrderStatusTone(fulfillmentStatus),
            detailItems: [
              {
                label: "Order Type",
                value: isSubscriptionOrder ? "Subscription" : "Normal",
              },
              ...(subscriptionId
                ? [{ label: "Subscription ID", value: `#${subscriptionId}` }]
                : []),
            ],
            trackingNumber:
              typeof order.trackingNumber === "string" ? order.trackingNumber : "",
            items: order.items as OrderEmailItem[],
            subtotal:
              typeof order.subtotal === "number" ? order.subtotal : order.total,
            shippingCost:
              typeof order.shippingCost === "number" ? order.shippingCost : 0,
            total: order.total,
            footerNote:
              isSubscriptionOrder && fulfillmentStatus === "fulfilled"
                ? "We will notify you again once the order has been shipped."
                : "Thank you for shopping with us. If you have any questions, simply reply to this email.",
          }),
        });
      } catch (emailError) {
        console.error("Order status email failed:", emailError);
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

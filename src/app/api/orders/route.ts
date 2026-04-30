import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";
import { sendEmail } from "@/lib/mail/nodemailer";
import {
  getOrderStatusSubject,
  getOrderStatusTone,
  renderOrderStatusEmail,
} from "@/lib/mail/templates";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

type OrderEmailItem = {
  name: string;
  price: number;
  quantity: number;
};

const getNormalizedPaymentStatus = (paymentStatus?: unknown) =>
  typeof paymentStatus === "string" && paymentStatus.trim()
    ? paymentStatus.trim().toLowerCase()
    : "pending";

const resolveOrderType = (
  order: {
    _id: unknown;
    orderType?: "normal" | "subscription";
    subscription?: unknown;
  },
  subscriptionOrderIds: Set<string>
): "normal" | "subscription" => {
  if (order.orderType === "normal" || order.orderType === "subscription") {
    return order.orderType;
  }

  const isSubscriptionOrder =
    Boolean(order.subscription) ||
    subscriptionOrderIds.has(String(order._id));

  return isSubscriptionOrder ? "subscription" : "normal";
};

export async function GET(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");
    const paymentScopeParam = searchParams.get("paymentScope");
    const requestedType =
      typeParam === "normal" || typeParam === "subscription"
        ? typeParam
        : "all";
    const paymentScope =
      paymentScopeParam === "pending" ||
      paymentScopeParam === "all" ||
      paymentScopeParam === "non_pending"
        ? paymentScopeParam
        : "non_pending";

    const [orders, subscriptionRefs] = await Promise.all([
      Order.find({}).sort({ createdAt: -1 }).lean(),
      Subscription.find({}, { orderId: 1 }).lean(),
    ]);

    const subscriptionOrderIds = new Set(
      subscriptionRefs
        .filter((sub) => sub.orderId)
        .map((sub) => String(sub.orderId))
    );

    const ordersWithType = orders.map((order) => ({
      ...order,
      orderType: resolveOrderType(order, subscriptionOrderIds),
    }));

    const filteredOrders = ordersWithType.filter((order) => {
      const matchesType =
        requestedType === "all" ? true : order.orderType === requestedType;

      if (!matchesType) {
        return false;
      }

      const paymentStatus = getNormalizedPaymentStatus(order.paymentStatus);

      if (paymentScope === "pending") {
        return paymentStatus === "pending";
      }

      if (paymentScope === "all") {
        return true;
      }

      return paymentStatus !== "pending";
    });

    return NextResponse.json({ orders: filteredOrders });
  } catch (error) {
    console.error("Orders fetch error:", error);

    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// 🔥 PATCH — UPDATE STATUS + SEND EMAIL
export async function PATCH(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const body = await req.json();
    const { orderId, status, trackingNumber } = body;
    const normalizedStatus =
      typeof status === "string" ? status.trim().toLowerCase() : "";
    const trimmedTrackingNumber =
      typeof trackingNumber === "string" ? trackingNumber.trim() : "";
    const allowedStatuses = ["unfulfilled", "fulfilled", "shipped", "completed"];

    if (!orderId || !normalizedStatus) {
      return NextResponse.json(
        { error: "Missing orderId or status" },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(normalizedStatus)) {
      return NextResponse.json(
        { error: "Invalid fulfillment status value" },
        { status: 400 }
      );
    }

    if (normalizedStatus === "shipped" && !trimmedTrackingNumber) {
      return NextResponse.json(
        { error: "Waybill number is required when marking as shipped" },
        { status: 400 }
      );
    }

    // Prepare update payload
    const updatePayload: {
      fulfillmentStatus: string;
      trackingNumber?: string;
      shippedAt?: Date | null;
      deliveredAt?: Date | null;
      updatedAt: Date;
    } = {
      fulfillmentStatus: normalizedStatus,
      updatedAt: new Date(),
    };
    if (normalizedStatus === "shipped") {
      updatePayload.trackingNumber = trimmedTrackingNumber;
      updatePayload.shippedAt = new Date();
    }
    if (normalizedStatus === "completed") {
      updatePayload.deliveredAt = new Date();
    }
    if (normalizedStatus !== "shipped" && typeof trackingNumber === "string") {
      updatePayload.trackingNumber = trimmedTrackingNumber;
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // 📧 SEND EMAIL
    if (order.billingDetails.email) {
        let message = "";
        const recipientName = order.billingDetails.firstName || "Customer";
        const isSubscriptionOrder =
          order.orderType === "subscription" || Boolean(order.subscription);

        switch (normalizedStatus) {
          case "fulfilled":
            message = `Hi ${recipientName}, your order has been packed and is ready for shipment.`;
            break;
          case "shipped":
            message = `Hi ${recipientName}, your order has been shipped.`;
            break;
          case "completed":
            message = `Hi ${recipientName}, your order has been delivered successfully.`;
            break;
          default:
            message = "Your order status has been updated.";
        }

        const formattedOrderId = order._id.toString().slice(-6).toUpperCase();

        try {
          await sendEmail({
            to: order.billingDetails.email,
            subject: getOrderStatusSubject({
              orderCode: formattedOrderId,
              status: normalizedStatus,
              isSubscriptionOrder,
            }),
            html: renderOrderStatusEmail({
              eyebrow: isSubscriptionOrder ? "Subscription Order" : "Order Update",
              title: "Order update",
              lead: message,
              orderCode: formattedOrderId,
              statusLabel: normalizedStatus,
              statusTone: getOrderStatusTone(normalizedStatus),
              trackingNumber:
                typeof order.trackingNumber === "string"
                  ? order.trackingNumber
                  : trimmedTrackingNumber,
              items: order.items as OrderEmailItem[],
              subtotal:
                typeof order.subtotal === "number" ? order.subtotal : order.total,
              shippingCost:
                typeof order.shippingCost === "number" ? order.shippingCost : 0,
              total: order.total,
              footerNote:
                "Thank you for shopping with us. We will keep you updated if there are any further changes to your order.",
            }),
          });
        } catch (emailError) {
          console.error("Email failed:", emailError);
        }
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("ADMIN ORDER UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

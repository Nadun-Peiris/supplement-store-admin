import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { sendEmail } from "@/lib/mail/nodemailer";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";

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
    await connectDB();

    const body = await req.json();
    const { fulfillmentStatus, trackingNumber } = body;

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
      (typeof trackingNumber !== "string" || !trackingNumber.trim())
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
      updateData.trackingNumber = trackingNumber.trim();
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
        message = `Hi ${recipientName}, your order has been packed and is ready for shipment. 📦`;
      } else if (fulfillmentStatus === "shipped") {
        message = `Hi ${recipientName}, good news! Your order is on its way. 🚚`;
      } else if (fulfillmentStatus === "completed") {
        message = `Hi ${recipientName}, your order has been delivered successfully. 🎉`;
      }

      const statusColor =
        fulfillmentStatus === "completed"
          ? "#28a745"
          : fulfillmentStatus === "shipped"
          ? "#007bff"
          : fulfillmentStatus === "fulfilled"
          ? "#01C7FE"
          : "#6c757d";

      try {
        await sendEmail({
          to: recipientEmail,
          subject: `Order Update: #${formattedOrderId}`,
          html: `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">

    <div style="background: #000; color: #fff; padding: 20px; text-align: center;">
      <h2 style="margin: 0; font-size: 24px;">Supplement Store</h2>
    </div>

    <div style="padding: 30px 20px;">
      <h3 style="margin-top: 0; color: #111;">${
        isSubscriptionOrder && fulfillmentStatus === "fulfilled"
          ? "ORDER CONFIRMED"
          : "Order Update"
      }</h3>
      <p style="color: #555; font-size: 15px; margin-bottom: 20px;">
        Order <strong>#${formattedOrderId}</strong>
      </p>

      <p style="font-size: 16px; color: #333; line-height: 1.5;">
        ${
          isSubscriptionOrder && fulfillmentStatus === "fulfilled"
            ? "Thank you for your order! Your payment has been confirmed and we are now processing your order."
            : message
        }
      </p>

      ${
        isSubscriptionOrder
          ? `
      <div style="margin: 24px 0 0 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
          <tbody>
            <tr>
              <td style="padding: 8px 0; color: #666;">Order type</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">Subscription Order</td>
            </tr>
            ${
              subscriptionId
                ? `
            <tr>
              <td style="padding: 8px 0; color: #666;">Subscription ID</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">#${subscriptionId}</td>
            </tr>
            `
                : ""
            }
          </tbody>
        </table>
      </div>
      `
          : ""
      }

      <div style="
        margin: 20px 0;
        padding: 15px;
        background: #f8f8f8;
        border-radius: 6px;
        border-left: 4px solid ${statusColor};
      ">
        <p style="margin: 0; font-size: 15px;">
          <strong>Current Status:</strong>
          <span style="
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            margin-left: 8px;
            background: ${statusColor};
          ">
            ${fulfillmentStatus.toUpperCase()}
          </span>
        </p>
      </div>

      ${
        trackingNumber
          ? `
      <div style="
        margin: 10px 0 20px 0;
        padding: 15px;
        background: #f0f9ff;
        border-radius: 6px;
        border: 1px solid #bae6fd;
      ">
        <p style="margin: 0; font-size: 14px; color: #0369a1;">
          <strong>Tracking / Waybill Number:</strong><br />
          <span style="color: #0284c7; font-size: 18px; font-weight: bold; display: inline-block; margin-top: 5px;">
            ${trackingNumber}
          </span>
        </p>
      </div>
      `
          : ""
      }

      <div style="margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
        <h4 style="margin: 0 0 15px 0; color: #111; font-size: 16px;">Order Summary</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #555;">
          <thead>
            <tr>
              <th style="padding: 0 0 10px 0; text-align: left; color: #777; font-size: 12px; text-transform: uppercase;">Product</th>
              <th style="padding: 0 0 10px 0; text-align: center; color: #777; font-size: 12px; text-transform: uppercase;">Qty</th>
              <th style="padding: 0 0 10px 0; text-align: right; color: #777; font-size: 12px; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${
              order.items && order.items.length > 0
                ? order.items
                    .map(
                      (item: OrderEmailItem) => `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eaeaea;">
                  ${item.name}
                </td>
                <td style="padding: 10px 0; text-align: center; border-bottom: 1px solid #eaeaea;">
                  ${item.quantity}
                </td>
                <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #eaeaea;">
                  LKR ${(item.price * item.quantity).toLocaleString()}
                </td>
              </tr>
            `
                    )
                    .join("")
                : `
              <tr>
                <td colspan="2" style="padding: 10px 0; color: #888;">
                  Item details unavailable
                </td>
              </tr>
            `
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 15px 0 0 0; font-weight: bold; color: #111; font-size: 14px;">
                Subtotal
              </td>
              <td style="padding: 15px 0 0 0; text-align: right; font-weight: bold; color: #111; font-size: 14px;">
                LKR ${typeof order.subtotal === "number" ? order.subtotal.toLocaleString() : order.total.toLocaleString()}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 10px 0 0 0; font-weight: bold; color: #111; font-size: 14px;">
                Shipping
              </td>
              <td style="padding: 10px 0 0 0; text-align: right; font-weight: bold; color: #111; font-size: 14px;">
                LKR ${typeof order.shippingCost === "number" ? order.shippingCost.toLocaleString() : "0"}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 15px 0 0 0; font-weight: bold; color: #111; font-size: 16px;">
                Grand Total
              </td>
              <td style="padding: 15px 0 0 0; text-align: right; font-weight: bold; color: #01C7FE; font-size: 18px;">
                LKR ${order.total ? order.total.toLocaleString() : "0"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style="font-size: 14px; color: #777; margin-top: 30px; line-height: 1.5;">
        ${
          isSubscriptionOrder && fulfillmentStatus === "fulfilled"
            ? "We will notify you when your order is shipped."
            : "Thank you for shopping with us! We will keep you updated if there are any further changes to your order."
        }
      </p>
      <p style="font-size: 14px; color: #777; margin-top: 16px; line-height: 1.5;">
        If you have any questions, simply reply to this email.
      </p>
    </div>

    <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Supplement Store. All rights reserved.</p>
    </div>

  </div>
</div>
          `,
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

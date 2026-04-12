import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import { sendEmail } from "@/lib/mail/nodemailer";

// ✅ GET ORDERS (UNCHANGED)
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");
    const requestedType =
      typeParam === "normal" || typeParam === "subscription"
        ? typeParam
        : "all";

    const [orders, subscriptionRefs] = await Promise.all([
      Order.find({}).sort({ createdAt: -1 }).lean(),
      Subscription.find({}, { orderId: 1 }).lean(),
    ]);

    const subscriptionOrderIds = new Set(
      subscriptionRefs
        .filter((sub) => sub.orderId)
        .map((sub) => String(sub.orderId))
    );

    const ordersWithType = orders.map((order) => {
      const isSubscriptionOrder = subscriptionOrderIds.has(String(order._id));
      return {
        ...order,
        orderType: isSubscriptionOrder ? "subscription" : "normal",
      };
    });

    const filteredOrders =
      requestedType === "all"
        ? ordersWithType
        : ordersWithType.filter(
            (order) => order.orderType === requestedType
          );

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
    await connectDB();

    const body = await req.json();
    const { orderId, status, trackingNumber } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "Missing orderId or status" },
        { status: 400 }
      );
    }

    // Prepare update payload
    const updatePayload: any = { fulfillmentStatus: status };
    if (trackingNumber !== undefined) {
      updatePayload.trackingNumber = trackingNumber;
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      updatePayload,
      { new: true }
    );

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // 📧 SEND EMAIL
    if (order.user) {
      const user = await User.findById(order.user);

      if (user?.email) {
        let message = "";

        switch (status) {
          case "shipped":
            message = "Good news! Your order has been shipped 🚚";
            break;
          case "delivered":
            message = "Your order has been successfully delivered 🎉";
            break;
          case "cancelled":
            message = "Your order has been cancelled ❌";
            break;
          default:
            message = "Your order status has been updated.";
        }

        const formattedOrderId = order._id.toString().slice(-6).toUpperCase();

        try {
          await sendEmail({
            to: user.email,
            subject: `Order Update: #${formattedOrderId}`,
            html: `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">

    <div style="background: #000; color: #fff; padding: 20px; text-align: center;">
      <h2 style="margin: 0; font-size: 24px;">Supplement Store</h2>
    </div>

    <div style="padding: 30px 20px;">
      <h3 style="margin-top: 0; color: #111;">Order Update</h3>
      <p style="color: #555; font-size: 15px; margin-bottom: 20px;">
        Order <strong>#${formattedOrderId}</strong>
      </p>

      <p style="font-size: 16px; color: #333; line-height: 1.5;">${message}</p>

      <div style="
        margin: 20px 0;
        padding: 15px;
        background: #f8f8f8;
        border-radius: 6px;
        border-left: 4px solid ${
          status === "delivered" ? "#28a745" : status === "shipped" ? "#007bff" : status === "cancelled" ? "#dc3545" : "#6c757d"
        };
      ">
        <p style="margin: 0; font-size: 15px;"><strong>Current Status:</strong> 
          <span style="
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: bold;
            margin-left: 8px;
            background: ${
              status === "delivered"
                ? "#28a745"
                : status === "shipped"
                ? "#007bff"
                : status === "cancelled"
                ? "#dc3545"
                : "#6c757d"
            };
          ">
            ${status.toUpperCase()}
          </span>
        </p>
      </div>

      ${trackingNumber ? `
      <div style="
        margin: 10px 0 20px 0;
        padding: 15px;
        background: #f0f9ff;
        border-radius: 6px;
        border: 1px solid #bae6fd;
      ">
        <p style="margin: 0; font-size: 14px; color: #0369a1;">
          <strong>Tracking / Waybill Number:</strong><br/>
          <span style="color: #0284c7; font-size: 18px; font-weight: bold; display: inline-block; margin-top: 5px;">
            ${trackingNumber}
          </span>
        </p>
      </div>
      ` : ""}

      <div style="margin-top: 30px; border-top: 1px solid #eaeaea; padding-top: 20px;">
        <h4 style="margin: 0 0 15px 0; color: #111; font-size: 16px;">Order Summary</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #555;">
          <tbody>
            ${order.items && order.items.length > 0 ? order.items.map((item: any) => `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eaeaea;">
                  ${item.name} <span style="color: #888; margin-left: 5px;">x ${item.quantity}</span>
                </td>
                <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid #eaeaea;">
                  LKR ${(item.price * item.quantity).toLocaleString()}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="2" style="padding: 10px 0; border-bottom: 1px solid #eaeaea; color: #888;">
                  Item details unavailable
                </td>
              </tr>
            `}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding: 15px 0 0 0; font-weight: bold; color: #111; font-size: 16px;">Total</td>
              <td style="padding: 15px 0 0 0; text-align: right; font-weight: bold; color: #01C7FE; font-size: 18px;">
                LKR ${order.total ? order.total.toLocaleString() : '0'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style="font-size: 14px; color: #777; margin-top: 30px; line-height: 1.5;">
        Thank you for shopping with us! We will keep you updated if there are any further changes to your order.
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
          console.error("Email failed:", emailError);
        }
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
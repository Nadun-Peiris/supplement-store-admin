import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";
import Subscription from "@/models/Subscription";

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
        : ordersWithType.filter((order) => order.orderType === requestedType);

    return NextResponse.json({ orders: filteredOrders });
  } catch (error) {
    console.error("Orders fetch error:", error);

    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

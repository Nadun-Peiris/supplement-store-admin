import { connectDB } from "@/lib/mongoose";
import Subscription from "@/models/Subscription";
import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

export async function GET(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const subscriptions = await Subscription.find()
      .populate({
        path: "orderId",
        select: "billingDetails total createdAt",
      })
      .sort({ createdAt: -1 });

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error("GET SUBSCRIPTIONS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

import { connectDB } from "@/lib/mongoose";
import Subscription from "@/models/Subscription";
import { NextResponse } from "next/server";

export async function GET() {
  await connectDB();

  const subscriptions = await Subscription.find()
    .populate({
      path: "orderId",
      select: "billingDetails total createdAt"
    })
    .sort({ createdAt: -1 });

  return NextResponse.json({ subscriptions });
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Order from "@/models/Order";

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

    const order = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!order) {
      return NextResponse.json(
        { error: `Order not found for id ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Order update error:", error);

    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

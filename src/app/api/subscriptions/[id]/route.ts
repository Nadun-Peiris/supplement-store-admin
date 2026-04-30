import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Subscription from "@/models/Subscription";
import User from "@/models/User";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const body = await req.json();
    const { status, adminViewed } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof adminViewed === "boolean") {
      updates.adminViewed = adminViewed;
    }

    if (typeof status === "string") {
      if (status !== "cancelled") {
        return NextResponse.json(
          { error: "Only 'cancelled' status is allowed for subscription status updates" },
          { status: 400 }
        );
      }

      updates.status = "cancelled";
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const { id } = await params;

    const subscription = await Subscription.findById(id);

    if (!subscription) {
      return NextResponse.json(
        { error: `Subscription not found for id ${id}` },
        { status: 404 }
      );
    }

    subscription.set(updates);
    await subscription.save();

    if (updates.status === "cancelled") {
      await User.findByIdAndUpdate(subscription.user, {
        $set: {
          "subscription.active": false,
          "subscription.status": "cancelled",
          "subscription.nextBillingDate": null,
          "subscription.lastPaymentDate": subscription.lastPaymentDate ?? null,
        },
      });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Subscription update error:", error);

    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}

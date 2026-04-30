import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { sendEmail } from "@/lib/mail/nodemailer";
import { renderSubscriptionReminderEmail } from "@/lib/mail/templates";
import Subscription from "@/models/Subscription";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

type ReminderRecipient = {
  _id: string;
  subscriptionId: string;
  recurrence?: string;
  nextBillingDate?: Date | string | null;
  orderId?: {
    total?: number;
    billingDetails?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  } | null;
  user?: {
    fullName?: string;
    email?: string;
  } | null;
};

function getReminderWindow() {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 5);

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getRecipientDetails(subscription: ReminderRecipient) {
  const billingDetails = subscription.orderId?.billingDetails;
  const nameFromBilling = `${billingDetails?.firstName || ""} ${billingDetails?.lastName || ""}`.trim();

  return {
    email: billingDetails?.email || subscription.user?.email || "",
    name: nameFromBilling || subscription.user?.fullName || "Customer",
  };
}

export async function POST(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { start, end } = getReminderWindow();

    const subscriptions = (await Subscription.find({
      status: "active",
      nextBillingDate: {
        $gte: start,
        $lte: end,
      },
    })
      .populate({
        path: "orderId",
        select: "billingDetails total",
      })
      .populate({
        path: "user",
        select: "email fullName",
      })
      .lean()) as ReminderRecipient[];

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sentCount: 0,
        skippedCount: 0,
        message: "No subscriptions are due for renewal in 5 days.",
      });
    }

    let sentCount = 0;
    let skippedCount = 0;

    for (const subscription of subscriptions) {
      const { email, name } = getRecipientDetails(subscription);

      if (!email) {
        skippedCount += 1;
        continue;
      }

      const nextBillingDate = subscription.nextBillingDate
        ? new Date(subscription.nextBillingDate)
        : null;
      const formattedBillingDate = nextBillingDate
        ? nextBillingDate.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "in 5 days";
      const formattedAmount = Number(
        subscription.orderId?.total || 0
      ).toLocaleString();

      await sendEmail({
        to: email,
        subject: `Subscription Renews on ${formattedBillingDate}: #${subscription.subscriptionId}`,
        html: renderSubscriptionReminderEmail({
          customerName: name,
          subscriptionCode: subscription.subscriptionId,
          formattedBillingDate,
          formattedAmount,
          recurrence: subscription.recurrence || "1 Month",
        }),
      });

      sentCount += 1;
    }

    return NextResponse.json({
      success: true,
      sentCount,
      skippedCount,
      message: `Sent ${sentCount} reminder email${sentCount === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    console.error("Subscription reminder email error:", error);

    return NextResponse.json(
      { error: "Failed to send subscription reminder emails." },
      { status: 500 }
    );
  }
}

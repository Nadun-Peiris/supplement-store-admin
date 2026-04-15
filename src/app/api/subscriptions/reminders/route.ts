import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { sendEmail } from "@/lib/mail/nodemailer";
import Subscription from "@/models/Subscription";

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

export async function POST() {
  try {
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
        subject: `Subscription Renewal Reminder: #${subscription.subscriptionId}`,
        html: `
<div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <div style="max-width: 600px; margin: auto; background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
    <div style="background: #000; color: #fff; padding: 20px; text-align: center;">
      <h2 style="margin: 0; font-size: 24px;">Supplement Store</h2>
    </div>

    <div style="padding: 30px 20px;">
      <h3 style="margin-top: 0; color: #111;">Subscription Renewal Reminder</h3>
      <p style="font-size: 16px; color: #333; line-height: 1.6;">
        Hi ${name}, this is a reminder that your subscription <strong>#${subscription.subscriptionId}</strong> is scheduled to renew on <strong>${formattedBillingDate}</strong>.
      </p>

      <div style="margin: 24px 0; padding: 18px; background: #f8f8f8; border-radius: 8px; border-left: 4px solid #01C7FE;">
        <p style="margin: 0 0 10px 0; color: #555; font-size: 14px;"><strong>Renewal amount:</strong> LKR ${formattedAmount}</p>
        <p style="margin: 0 0 10px 0; color: #555; font-size: 14px;"><strong>Recurrence:</strong> ${subscription.recurrence || "1 Month"}</p>
        <p style="margin: 0; color: #555; font-size: 14px;"><strong>Renewal date:</strong> ${formattedBillingDate}</p>
      </div>

      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Please make sure your payment method is ready so your renewal can be processed without interruption.
      </p>

      <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 24px;">
        If you have any questions, reply to this email and our team will assist you.
      </p>
    </div>

    <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Supplement Store. All rights reserved.</p>
    </div>
  </div>
</div>
        `,
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

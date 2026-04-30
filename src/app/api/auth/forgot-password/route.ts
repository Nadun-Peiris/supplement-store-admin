import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { connectDB } from "@/lib/mongoose";
import { sendEmail } from "@/lib/mail/nodemailer";
import { renderPasswordResetEmail } from "@/lib/mail/templates";
import User from "@/models/User";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    await connectDB();

    const eligibleAdmin = await User.findOne({
      email,
      role: { $in: ["admin", "superadmin"] },
      isBlocked: false,
    })
      .select("_id")
      .lean();

    if (!eligibleAdmin) {
      return NextResponse.json({
        success: true,
        message: "If the account is eligible, a reset link will be sent.",
      });
    }

    const origin = new URL(req.url).origin;
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${origin}/login`,
    });

    await sendEmail({
      to: email,
      subject: "Admin Password Reset Request",
      html: renderPasswordResetEmail({ resetLink }),
    });

    return NextResponse.json({
      success: true,
      message: "Reset link sent to your inbox!",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return NextResponse.json(
      { error: "Failed to send reset link" },
      { status: 500 }
    );
  }
}

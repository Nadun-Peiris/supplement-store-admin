import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { sendEmail } from "@/lib/mail/nodemailer";

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

    const origin = new URL(req.url).origin;
    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${origin}/login`,
    });

    await sendEmail({
      to: email,
      subject: "Reset your Supplement Store admin password",
      html: `
<div style="font-family: Arial, sans-serif; background-color: #f4f7fb; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
    <div style="background: #03c7fe; color: #ffffff; padding: 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Supplement Store Admin</h1>
    </div>

    <div style="padding: 32px 24px; color: #111827;">
      <h2 style="margin-top: 0; font-size: 20px;">Reset your password</h2>
      <p style="font-size: 15px; line-height: 1.7; color: #374151;">
        We received a request to reset the password for your admin account.
      </p>
      <p style="font-size: 15px; line-height: 1.7; color: #374151;">
        Click the button below to choose a new password:
      </p>

      <div style="margin: 32px 0; text-align: center;">
        <a
          href="${resetLink}"
          style="display: inline-block; padding: 14px 24px; border-radius: 10px; background: #03c7fe; color: #ffffff; text-decoration: none; font-weight: 700;"
        >
          Reset Password
        </a>
      </div>

      <p style="font-size: 14px; line-height: 1.7; color: #6b7280;">
        If the button does not work, copy and paste this link into your browser:
      </p>
      <p style="font-size: 13px; line-height: 1.7; color: #2563eb; word-break: break-all;">
        ${resetLink}
      </p>

      <p style="font-size: 14px; line-height: 1.7; color: #6b7280; margin-top: 24px;">
        If you did not request a password reset, you can ignore this email.
      </p>
    </div>
  </div>
</div>
      `,
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

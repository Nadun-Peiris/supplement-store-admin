import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { connectDB } from "@/lib/mongoose";
import { sendEmail } from "@/lib/mail/nodemailer";
import { renderPasswordResetEmail } from "@/lib/mail/templates";
import User from "@/models/User";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const forgotPasswordRateLimit = new Map<string, { count: number; resetAt: number }>();

const getClientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  req.headers.get("x-real-ip") ||
  "unknown";

const isRateLimited = (clientId: string) => {
  const now = Date.now();
  const entry = forgotPasswordRateLimit.get(clientId);

  if (!entry || entry.resetAt <= now) {
    forgotPasswordRateLimit.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
};

export async function POST(req: Request) {
  try {
    const clientId = getClientIp(req);
    if (isRateLimited(clientId)) {
      return NextResponse.json(
        { error: "Too many reset requests. Please try again later." },
        { status: 429 }
      );
    }

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

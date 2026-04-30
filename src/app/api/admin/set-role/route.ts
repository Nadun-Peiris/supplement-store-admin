import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { adminAuth } from "@/lib/firebaseAdmin";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

export async function GET(req: Request) {
  try {
    const guard = await verifyAdmin(req, { requireSuperadmin: true });
    if ("error" in guard) return guard.error;

    await connectDB();

    const admins = await User.find({
      role: { $in: ["admin", "superadmin"] },
    })
      .select("_id email role")
      .sort({ email: 1 })
      .lean();

    return NextResponse.json({
      admins: admins.map((u) => ({
        _id: u._id.toString(),
        email: u.email,
        role: u.role,
      })),
    });
  } catch (error: unknown) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Failed to fetch admins" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const guard = await verifyAdmin(req, { requireSuperadmin: true });
    if ("error" in guard) return guard.error;

    await connectDB();

    const { email, makeAdmin } = await req.json();

    if (!email || typeof makeAdmin !== "boolean") {
      return NextResponse.json(
        { error: "Email and makeAdmin are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const targetUser = await User.findOne({ email: normalizedEmail });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found in MongoDB" }, { status: 404 });
    }

    // Superadmin must remain immutable from this endpoint.
    if (targetUser.role === "superadmin") {
      return NextResponse.json(
        { error: "Cannot modify superadmin from this action" },
        { status: 403 }
      );
    }

    if (
      !makeAdmin &&
      guard.user.email?.toLowerCase?.() === normalizedEmail
    ) {
      return NextResponse.json(
        { error: "Superadmin cannot revoke their own access" },
        { status: 403 }
      );
    }

    targetUser.role = makeAdmin ? "admin" : "customer";
    await targetUser.save();

    // Keep Firebase custom claims aligned for legacy claim checks.
    const firebaseUser = await adminAuth.getUserByEmail(normalizedEmail);
    await adminAuth.setCustomUserClaims(firebaseUser.uid, {
      admin: makeAdmin,
      role: targetUser.role,
    });

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      role: targetUser.role,
      message: makeAdmin
        ? "✅ User promoted to admin successfully."
        : "❎ Admin privileges removed.",
    });
  } catch (error: unknown) {
    console.error("Error updating admin role:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update admin role.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

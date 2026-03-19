import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { verifyToken } from "@/utils/verifyToken";

export async function GET(req: Request) {
  try {
    await connectDB();

    const token = req.headers
      .get("authorization")
      ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await User.findOne({
      firebaseId: decoded.uid,
    });

    if (!currentUser || currentUser.role === "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await User.find().lean();

    const rolePriority: Record<string, number> = {
      superadmin: 0,
      admin: 1,
      customer: 2,
    };

    const normalizedUsers = users
      .map((u) => ({
        _id: u._id.toString(),
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role ?? "customer",
        isBlocked: u.isBlocked,
        subscription: {
          subscriptionId: u.subscription?.subscriptionId ?? null,
          active: u.subscription?.active ?? false,
          nextBillingDate: u.subscription?.nextBillingDate ?? null,
          status: u.subscription?.status ?? null,
          lastPaymentDate: u.subscription?.lastPaymentDate ?? null,
        },
        createdAt: u.createdAt,
      }))
      .sort((a, b) => {
        const roleDiff = (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
        if (roleDiff !== 0) return roleDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return NextResponse.json({
      users: normalizedUsers,
      currentUserId: currentUser._id.toString(),
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { verifyToken } from "@/utils/verifyToken";

export async function GET(req: Request) {
  try {
    await connectDB();

    const token = req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(token);

    const user = await User.findOne({ firebaseId: decoded.uid }).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "User is blocked" }, { status: 403 });
    }

    if (user.role !== "admin" && user.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, role: user.role });
  } catch (error) {
    console.error("VALIDATE ROLE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to validate role" },
      { status: 500 }
    );
  }
}

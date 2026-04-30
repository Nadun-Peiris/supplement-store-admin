import { NextResponse } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { HydratedDocument } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import User, { type IUser } from "@/models/User";
import { verifySessionToken, verifyToken } from "@/utils/verifyToken";

type AdminDocument = HydratedDocument<IUser>;

type GuardOptions = {
  requireSuperadmin?: boolean;
};

type GuardFailure = {
  error: NextResponse;
};

type GuardSuccess = {
  decoded: DecodedIdToken;
  token: string;
  user: AdminDocument;
};

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbidden = (message = "Forbidden") =>
  NextResponse.json({ error: message }, { status: 403 });

export function getBearerToken(req: Request) {
  const rawHeader = req.headers.get("authorization");

  if (!rawHeader) {
    return "";
  }

  return rawHeader.replace(/^Bearer\s+/i, "").trim();
}

async function resolveAdminUser(
  uid: string,
  options: GuardOptions = {}
): Promise<GuardFailure | { user: AdminDocument }> {
  await connectDB();

  const user = await User.findOne({ firebaseId: uid });

  if (!user) {
    return {
      error: NextResponse.json({ error: "User not found" }, { status: 404 }),
    };
  }

  if (user.isBlocked) {
    return { error: forbidden("User is blocked") };
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    return { error: forbidden() };
  }

  if (options.requireSuperadmin && user.role !== "superadmin") {
    return {
      error: forbidden("Only superadmin can perform this action"),
    };
  }

  return { user };
}

export async function verifyAdmin(
  req: Request,
  options: GuardOptions = {}
): Promise<GuardFailure | GuardSuccess> {
  const token = getBearerToken(req);

  if (!token) {
    return { error: unauthorized() };
  }

  let decoded: DecodedIdToken;

  try {
    decoded = await verifyToken(token);
  } catch {
    return { error: unauthorized() };
  }

  const result = await resolveAdminUser(decoded.uid, options);

  if ("error" in result) {
    return result;
  }

  return {
    decoded,
    token,
    user: result.user,
  };
}

export async function verifyAdminSession(
  sessionCookie: string,
  options: GuardOptions = {}
) {
  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await verifySessionToken(sessionCookie);
    const result = await resolveAdminUser(decoded.uid, options);

    if ("error" in result) {
      return null;
    }

    return result.user;
  } catch {
    return null;
  }
}

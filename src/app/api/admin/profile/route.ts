import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { verifyToken } from "@/utils/verifyToken";

const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
const GOAL_OPTIONS = ["Weight Loss", "Muscle Gain", "Maintenance", "Body Transformation"] as const;
const ACTIVITY_OPTIONS = ["Sedentary", "Light", "Moderate", "Active", "Very Active"] as const;
const DIET_OPTIONS = ["Standard", "Vegetarian", "Vegan", "Keto", "Paleo"] as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeUser = (user: {
  _id: { toString: () => string };
  firebaseId?: unknown;
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  age?: unknown;
  gender?: unknown;
  height?: unknown;
  weight?: unknown;
  bmi?: unknown;
  goal?: unknown;
  activity?: unknown;
  conditions?: unknown;
  diet?: unknown;
  sleepHours?: unknown;
  waterIntake?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  postalCode?: unknown;
  country?: unknown;
  subscription?: {
    subscriptionId?: unknown;
    active?: unknown;
    nextBillingDate?: unknown;
    status?: unknown;
    lastPaymentDate?: unknown;
  };
  role?: unknown;
  isBlocked?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) => ({
  _id: user._id.toString(),
  firebaseId: user.firebaseId ?? null,
  fullName: user.fullName ?? "",
  email: user.email ?? "",
  phone: user.phone ?? "",
  age: user.age ?? null,
  gender: user.gender ?? "",
  height: user.height ?? null,
  weight: user.weight ?? null,
  bmi: user.bmi ?? null,
  goal: user.goal ?? "",
  activity: user.activity ?? "",
  conditions: user.conditions ?? "",
  diet: user.diet ?? "",
  sleepHours: user.sleepHours ?? null,
  waterIntake: user.waterIntake ?? null,
  addressLine1: user.addressLine1 ?? "",
  addressLine2: user.addressLine2 ?? "",
  city: user.city ?? "",
  postalCode: user.postalCode ?? "",
  country: user.country ?? "",
  subscription: {
    subscriptionId: user.subscription?.subscriptionId ?? null,
    active: user.subscription?.active ?? false,
    nextBillingDate: user.subscription?.nextBillingDate ?? null,
    status: user.subscription?.status ?? null,
    lastPaymentDate: user.subscription?.lastPaymentDate ?? null,
  },
  role: user.role ?? "customer",
  isBlocked: user.isBlocked ?? false,
  createdAt: user.createdAt ?? null,
  updatedAt: user.updatedAt ?? null,
});

async function getCurrentAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await User.findOne({ firebaseId: decoded.uid });

  if (!user) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (user.isBlocked) {
    return { error: NextResponse.json({ error: "User is blocked" }, { status: 403 }) };
  }

  if (user.role !== "admin" && user.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function GET(req: Request) {
  try {
    await connectDB();

    const guard = await getCurrentAdmin(req);
    if (guard.error) return guard.error;

    return NextResponse.json({ user: normalizeUser(guard.user.toObject()) });
  } catch (error) {
    console.error("GET ADMIN PROFILE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    await connectDB();

    const guard = await getCurrentAdmin(req);
    if (guard.error) return guard.error;

    const body = await req.json();
    const setData: Record<string, unknown> = {};
    const unsetData: Record<string, ""> = {};

    const assignRequiredString = (field: string) => {
      if (body[field] === undefined) return;
      if (!isNonEmptyString(body[field])) {
        throw new Error(`${field} must be a non-empty string`);
      }
      setData[field] = body[field].trim();
    };

    const assignOptionalString = (field: string) => {
      if (body[field] === undefined) return;
      if (typeof body[field] !== "string") {
        throw new Error(`${field} must be a string`);
      }
      const value = body[field].trim();
      if (!value) {
        unsetData[field] = "";
        return;
      }
      setData[field] = value;
    };

    const assignRequiredEnum = (field: string, allowed: readonly string[]) => {
      if (body[field] === undefined) return;
      if (typeof body[field] !== "string") {
        throw new Error(`${field} must be a string`);
      }
      const value = body[field].trim();
      if (!value) {
        throw new Error(`${field} is required`);
      }
      if (!allowed.includes(value)) {
        throw new Error(`Invalid ${field} value`);
      }
      setData[field] = value;
    };

    const assignOptionalEnum = (field: string, allowed: readonly string[]) => {
      if (body[field] === undefined) return;
      if (typeof body[field] !== "string") {
        throw new Error(`${field} must be a string`);
      }
      const value = body[field].trim();
      if (!value) {
        unsetData[field] = "";
        return;
      }
      if (!allowed.includes(value)) {
        throw new Error(`Invalid ${field} value`);
      }
      setData[field] = value;
    };

    const assignRequiredNumber = (field: string) => {
      if (body[field] === undefined) return;
      const raw = body[field];
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num)) {
        throw new Error(`${field} must be a valid number`);
      }
      setData[field] = num;
    };

    const assignOptionalNumber = (field: string) => {
      if (body[field] === undefined) return;
      const raw = body[field];
      if (raw === "" || raw === null) {
        unsetData[field] = "";
        return;
      }
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num)) {
        throw new Error(`${field} must be a valid number`);
      }
      setData[field] = num;
    };

    if (body.email !== undefined && body.email !== guard.user.email) {
      return NextResponse.json(
        { error: "Email cannot be changed from this page" },
        { status: 400 }
      );
    }

    if (body.role !== undefined || body.isBlocked !== undefined || body.subscription !== undefined) {
      return NextResponse.json(
        { error: "Restricted profile fields cannot be changed here" },
        { status: 400 }
      );
    }

    assignRequiredString("fullName");
    assignRequiredString("phone");
    assignRequiredEnum("gender", GENDER_OPTIONS);
    assignRequiredString("addressLine1");
    assignRequiredString("city");
    assignRequiredString("postalCode");
    assignRequiredString("country");
    assignRequiredNumber("age");

    assignOptionalNumber("height");
    assignOptionalNumber("weight");
    assignOptionalNumber("bmi");
    assignOptionalNumber("sleepHours");
    assignOptionalNumber("waterIntake");

    assignOptionalEnum("goal", GOAL_OPTIONS);
    assignOptionalEnum("activity", ACTIVITY_OPTIONS);
    assignOptionalEnum("diet", DIET_OPTIONS);

    assignOptionalString("conditions");
    assignOptionalString("addressLine2");

    if (Object.keys(setData).length === 0 && Object.keys(unsetData).length === 0) {
      return NextResponse.json({ user: normalizeUser(guard.user.toObject()) });
    }

    const updatedUser = await User.findByIdAndUpdate(
      guard.user._id,
      {
        ...(Object.keys(setData).length ? { $set: setData } : {}),
        ...(Object.keys(unsetData).length ? { $unset: unsetData } : {}),
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      user: normalizeUser(updatedUser),
    });
  } catch (error) {
    console.error("UPDATE ADMIN PROFILE ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import { verifyToken } from "@/utils/verifyToken";
import { adminAuth } from "@/lib/firebaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

const GENDER_OPTIONS = ["Male", "Female", "Other"] as const;
const GOAL_OPTIONS = ["Weight Loss", "Muscle Gain", "Maintenance", "Body Transformation"] as const;
const ACTIVITY_OPTIONS = ["Sedentary", "Light", "Moderate", "Active", "Very Active"] as const;
const DIET_OPTIONS = ["Standard", "Vegetarian", "Vegan", "Keto", "Paleo"] as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

type LeanUserDoc = {
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
};

const toPublicUser = (u: LeanUserDoc) => ({
  _id: u._id.toString(),
  firebaseId: u.firebaseId,
  fullName: u.fullName,
  email: u.email,
  phone: u.phone,
  age: u.age,
  gender: u.gender,
  height: u.height,
  weight: u.weight,
  bmi: u.bmi,
  goal: u.goal,
  activity: u.activity,
  conditions: u.conditions,
  diet: u.diet,
  sleepHours: u.sleepHours,
  waterIntake: u.waterIntake,
  addressLine1: u.addressLine1,
  addressLine2: u.addressLine2,
  city: u.city,
  postalCode: u.postalCode,
  country: u.country,
  subscription: {
    subscriptionId: u.subscription?.subscriptionId ?? null,
    active: u.subscription?.active ?? false,
    nextBillingDate: u.subscription?.nextBillingDate ?? null,
    status: u.subscription?.status ?? null,
    lastPaymentDate: u.subscription?.lastPaymentDate ?? null,
  },
  role: u.role,
  isBlocked: u.isBlocked,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const getCurrentUser = async (req: Request) => {
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

  const currentUser = await User.findOne({ firebaseId: decoded.uid });

  if (!currentUser || currentUser.role !== "superadmin") {
    return {
      error: NextResponse.json({ error: "Only superadmin can manage users" }, { status: 403 }),
    };
  }

  return { currentUser };
};

export async function GET(req: Request, { params }: Params) {
  try {
    await connectDB();

    const guard = await getCurrentUser(req);
    if (guard.error) return guard.error;

    const { id } = await params;
    const user = await User.findById(id).lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("GET USER ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    await connectDB();

    const guard = await getCurrentUser(req);
    if (guard.error) return guard.error;

    const { currentUser } = guard;
    const { id } = await params;
    const body = await req.json();

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "superadmin") {
      return NextResponse.json({ error: "Cannot modify another superadmin" }, { status: 403 });
    }

    if (targetUser._id.toString() === currentUser._id.toString()) {
      return NextResponse.json({ error: "You cannot modify your own account here" }, { status: 403 });
    }

    if (body.role !== undefined) {
      return NextResponse.json(
        { error: "Role changes are not allowed from this form" },
        { status: 400 }
      );
    }

    const setData: Record<string, unknown> = {};
    const unsetData: Record<string, ""> = {};

    const assignRequiredString = (field: string) => {
      if (body[field] === undefined) return;
      if (!isNonEmptyString(body[field])) {
        throw new Error(`${field} must be a non-empty string`);
      }
      setData[field] = body[field].trim();
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

    assignRequiredString("fullName");
    assignRequiredString("email");
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

    if (typeof body.isBlocked === "boolean") {
      setData.isBlocked = body.isBlocked;

      if (!targetUser.firebaseId) {
        return NextResponse.json(
          { error: "Cannot sync user status without Firebase ID" },
          { status: 400 }
        );
      }

      await adminAuth.updateUser(targetUser.firebaseId, {
        disabled: body.isBlocked,
      });
    }

    if (Object.keys(setData).length === 0 && Object.keys(unsetData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const updateQuery: { $set?: Record<string, unknown>; $unset?: Record<string, ""> } = {};
    if (Object.keys(setData).length) updateQuery.$set = setData;
    if (Object.keys(unsetData).length) updateQuery.$unset = unsetData;

    await User.findByIdAndUpdate(id, updateQuery, { runValidators: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();

    const guard = await getCurrentUser(req);
    if (guard.error) return guard.error;

    const { currentUser } = guard;
    const { id } = await params;

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "superadmin") {
      return NextResponse.json({ error: "Cannot delete superadmin" }, { status: 403 });
    }

    if (targetUser._id.toString() === currentUser._id.toString()) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 403 }
      );
    }

    const deleted = await User.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

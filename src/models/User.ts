import mongoose, {
  Schema,
  Document,
  models,
  type Model,
  type Types,
} from "mongoose";

/* ---------------------------------------------------------
   TypeScript Interface
--------------------------------------------------------- */
export interface IUser extends Document {
  _id: Types.ObjectId;
  firebaseId: string;

  // Step 1 - Basic Info
  fullName: string;
  email: string;
  phone: string;
  age: number;
  gender: "Male" | "Female" | "Other";

  // Step 2 - Health & Lifestyle
  height?: number;
  weight?: number;
  bmi?: number;
  goal?: "Weight Loss" | "Muscle Gain" | "Maintenance" | "Body Transformation";
  activity?: "Sedentary" | "Light" | "Moderate" | "Active" | "Very Active";
  conditions?: string;
  diet?: "Standard" | "Vegetarian" | "Vegan" | "Keto" | "Paleo";
  sleepHours?: number;
  waterIntake?: number;

  // Step 3 - Billing & Address
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  country: string;

  // Subscription (Synced with PayHere logic)
  subscription: {
    subscriptionId: string | null; // PayHere Subscription ID
    active: boolean;
    nextBillingDate: Date | null;
    status: "active" | "cancelled" | "completed" | null;
    lastPaymentDate: Date | null;
  };

  // 🔐 Role & Permissions
  role: "customer" | "admin" | "superadmin";
  isBlocked: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/* ---------------------------------------------------------
   Mongoose Schema
--------------------------------------------------------- */
const UserSchema = new Schema<IUser>(
  {
    firebaseId: { type: String, required: true, unique: true },

    // Step 1: Basic
    fullName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: { type: String, required: true, unique: true },
    age: { type: Number, required: true },
    gender: { 
      type: String, 
      required: true, 
      enum: ["Male", "Female", "Other"] 
    },

    // Step 2: Health
    height: Number,
    weight: Number,
    bmi: Number,
    goal: {
      type: String,
      enum: ["Weight Loss", "Muscle Gain", "Maintenance", "Body Transformation"],
    },
    activity: {
      type: String,
      enum: ["Sedentary", "Light", "Moderate", "Active", "Very Active"],
    },
    conditions: { type: String, default: "" },
    diet: {
      type: String,
      enum: ["Standard", "Vegetarian", "Vegan", "Keto", "Paleo"],
      default: "Standard"
    },
    sleepHours: Number,
    waterIntake: Number,

    // Step 3: Billing
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: "Sri Lanka" },

    subscription: {
      subscriptionId: { type: String, default: null },
      active: { type: Boolean, default: false },
      nextBillingDate: { type: Date, default: null },
      status: { 
        type: String, 
        enum: ["active", "cancelled", "completed", null], 
        default: null 
      },
      lastPaymentDate: { type: Date, default: null },
    },

    // 🔐 ROLE SYSTEM
    role: {
      type: String,
      enum: ["customer", "admin", "superadmin"],
      default: "customer",
    },

    // 🔐 BLOCK SYSTEM
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically handles createdAt and updatedAt
  }
);

/* ---------------------------------------------------------
   Indexes
--------------------------------------------------------- */
// Ensure only one superadmin exists if needed, or just index roles
UserSchema.index(
  { role: 1 },
  {
    unique: false, // Changed from true to allow multiple admins/customers
  }
);

/* ---------------------------------------------------------
   Export Model
--------------------------------------------------------- */
const User: Model<IUser> =
  (models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;

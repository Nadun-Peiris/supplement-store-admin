// src/lib/mongoose.ts
import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("❌ Missing MONGODB_URI in .env.local");

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log("🟢 Admin App Connected to MongoDB");
  } catch (err) {
    console.error("🔴 Admin App MongoDB Connection Error:", err);
    throw err;
  }
}

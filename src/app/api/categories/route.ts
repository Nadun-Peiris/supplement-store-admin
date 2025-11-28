import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Category from "@/models/Category";

type RawCategory = {
  _id: string | { toString(): string };
  title?: string;
  name?: string;
  slug?: string;
  image?: string;
};

const normalizeId = (value?: string | { toString(): string }) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.toString?.() || "";
};

export async function GET() {
  try {
    await connectDB();

    const docs = (await Category.find().sort({ title: 1 }).lean()) as RawCategory[];

    const categories = docs.map((cat) => ({
      _id: normalizeId(cat._id),
      name: cat.title || cat.name || "",
      slug: cat.slug || "",
      image: cat.image || "",
    }));

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("ADMIN CATEGORIES API ERROR:", err);
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 }
    );
  }
}

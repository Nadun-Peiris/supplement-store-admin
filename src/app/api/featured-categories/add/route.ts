import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import FeaturedCategory from "@/models/FeaturedCategory";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

export async function POST(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { categoryId } = await req.json();

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    // 🔎 Prevent duplicates
    const existing = await FeaturedCategory.findOne({ categoryId });

    if (existing) {
      return NextResponse.json(
        { error: "Category already featured" },
        { status: 400 }
      );
    }

    // 🔎 Enforce max 8
    const count = await FeaturedCategory.countDocuments();

    if (count >= 8) {
      return NextResponse.json(
        { error: "Maximum of 8 featured categories allowed" },
        { status: 400 }
      );
    }

    // 🧠 Assign next index
    const newFeatured = await FeaturedCategory.create({
      categoryId,
      index: count,
    });

    return NextResponse.json(newFeatured, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to add featured category" },
      { status: 500 }
    );
  }
}

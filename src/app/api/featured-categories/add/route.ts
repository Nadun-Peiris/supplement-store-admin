import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import FeaturedCategory from "@/models/FeaturedCategory";
import Category from "@/models/Category";

export async function POST(req: Request) {
  try {
    await connectDB();

    const { categoryId } = await req.json();
    if (!categoryId)
      return NextResponse.json({ error: "Missing categoryId" }, { status: 400 });

    // Fetch full category for validation
    const category = await Category.findById(categoryId);
    if (!category)
      return NextResponse.json({ error: "Category not found" }, { status: 404 });

    // Limit total featured entries
    const MAX_FEATURED = 8;
    const total = await FeaturedCategory.countDocuments();
    if (total >= MAX_FEATURED) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_FEATURED} featured categories reached` },
        { status: 400 }
      );
    }

    // Check duplicate
    const exists = await FeaturedCategory.findOne({ categoryId });
    if (exists)
      return NextResponse.json({ error: "Already added" }, { status: 400 });

    // Get last index
    const last = await FeaturedCategory.findOne().sort({ index: -1 });

    const entry = await FeaturedCategory.create({
      categoryId,
      index: last ? last.index + 1 : 1,
    });

    return NextResponse.json({ success: true, entry });
  } catch (err) {
    console.error("ADD FEATURED ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

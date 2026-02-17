import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Category from "@/models/Category";
import slugify from "slugify";

export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find()
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      categories: categories.map((cat: any) => ({
        _id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        image: cat.image,
      })),
    });
  } catch (error) {
    console.error("GET CATEGORIES ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const { name, image } = await req.json();

    if (!name || !image) {
      return NextResponse.json(
        { error: "Name and image required" },
        { status: 400 }
      );
    }

    // 🔥 Generate slug manually
    let slug = slugify(name, {
      lower: true,
      strict: true,
    });

    // 🔥 Ensure slug uniqueness
    let existing = await Category.findOne({ slug });
    let counter = 1;

    while (existing) {
      slug = `${slug}-${counter}`;
      existing = await Category.findOne({ slug });
      counter++;
    }

    const category = await Category.create({
      name,
      slug,
      image,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    console.error("CREATE CATEGORY ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create category" },
      { status: 500 }
    );
  }
}

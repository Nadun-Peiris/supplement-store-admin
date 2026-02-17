import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Category from "@/models/Category";
import FeaturedCategory from "@/models/FeaturedCategory";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;
    const { name, image } = await req.json();

    const updated = await Category.findByIdAndUpdate(
      id,
      { name, image },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;

    const deleted = await Category.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    // 🔥 Remove from featured if exists
    await FeaturedCategory.deleteMany({ categoryId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
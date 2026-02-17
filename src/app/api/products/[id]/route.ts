import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import slugify from "slugify";

const slugOptions = { lower: true, strict: true, trim: true };

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await req.json();

    const {
      name,
      category,
      brandName,
      price,
      stock,
      image,
      hoverImage,
      description,
      isActive,
    } = body;

    let updateData: any = {
      category,
      brandName,
      price: Number(price),
      stock: Number(stock || 0),
      image,
      hoverImage,
      description,
      isActive,
    };

    // 🔥 Regenerate slug if name changed
    if (name) {
      const baseSlug = slugify(name, slugOptions);
      let slug = baseSlug;

      let existing = await Product.findOne({
        slug,
        _id: { $ne: id },
      });

      let counter = 1;

      while (existing) {
        slug = `${baseSlug}-${counter}`;
        existing = await Product.findOne({
          slug,
          _id: { $ne: id },
        });
        counter++;
      }

      updateData.name = name;
      updateData.slug = slug;
    }

    const updated = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;

    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Category from "@/models/Category";
import FeaturedCategory from "@/models/FeaturedCategory";
import Product from "@/models/Product";
import slugify from "slugify";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

const slugOptions = {
  lower: true,
  strict: true,
  trim: true,
};

async function reindexFeaturedCategories() {
  const remaining = await FeaturedCategory.find().sort({ index: 1, createdAt: 1 });

  await Promise.all(
    remaining.map((item, index) => {
      if (item.index === index) {
        return Promise.resolve();
      }

      item.index = index;
      return item.save();
    })
  );
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { id } = await params;
    const { name, image } = await req.json();
    const normalizedName =
      typeof name === "string" ? name.trim() : "";

    if (!normalizedName || !image) {
      return NextResponse.json(
        { error: "Name and image required" },
        { status: 400 }
      );
    }

    const existingCategory = await Category.findById(id);

    if (!existingCategory) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const previousName = existingCategory.name || existingCategory.title || "";
    const previousSlug = existingCategory.slug || "";
    const baseSlug = slugify(normalizedName, slugOptions);
    let nextSlug = baseSlug;
    let existingSlugMatch = await Category.findOne({
      slug: nextSlug,
      _id: { $ne: id },
    });
    let counter = 1;

    while (existingSlugMatch) {
      nextSlug = `${baseSlug}-${counter}`;
      existingSlugMatch = await Category.findOne({
        slug: nextSlug,
        _id: { $ne: id },
      });
      counter++;
    }

    const updated = await Category.findByIdAndUpdate(
      id,
      { name: normalizedName, title: normalizedName, slug: nextSlug, image },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    if (previousName !== normalizedName || previousSlug !== nextSlug) {
      await Product.updateMany(
        {
          $or: [
            { category: previousName },
            { categorySlug: previousSlug },
          ],
        },
        {
          $set: {
            category: normalizedName,
            categorySlug: nextSlug,
          },
        }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { id } = await params;
    const category = await Category.findById(id);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    const categoryName = category.name || category.title || "";
    const linkedProducts = await Product.countDocuments({
      $or: [
        { category: categoryName },
        { categorySlug: category.slug },
      ],
    });

    if (linkedProducts > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete a category that is still assigned to products",
        },
        { status: 409 }
      );
    }

    await Category.findByIdAndDelete(id);

    await FeaturedCategory.deleteMany({ categoryId: id });
    await reindexFeaturedCategories();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}

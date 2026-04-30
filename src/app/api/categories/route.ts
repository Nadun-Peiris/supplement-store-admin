import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Category from "@/models/Category";
import slugify from "slugify";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

const slugOptions = {
  lower: true,
  strict: true,
  trim: true,
};

const normalizeCategoryName = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

type CategoryListItem = {
  _id: { toString(): string };
  name?: string;
  title?: string;
  slug?: string;
  image?: string;
};

export async function GET(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const categories = (await Category.find().lean()) as CategoryListItem[];

    const normalizedCategories = categories
      .map((cat) => ({
        _id: cat._id.toString(),
        name: cat.name || cat.title || "",
        slug: cat.slug || "",
        image: cat.image || "",
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({
      categories: normalizedCategories,
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
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { name, image } = await req.json();
    const normalizedName = normalizeCategoryName(name);

    if (!normalizedName || !image) {
      return NextResponse.json(
        { error: "Name and image required" },
        { status: 400 }
      );
    }

    const baseSlug = slugify(normalizedName, slugOptions);
    let slug = baseSlug;

    let existing = await Category.findOne({ slug });
    let counter = 1;

    while (existing) {
      slug = `${baseSlug}-${counter}`;
      existing = await Category.findOne({ slug });
      counter++;
    }

    const category = await Category.create({
      name: normalizedName,
      title: normalizedName,
      slug,
      image,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("CREATE CATEGORY ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create category";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import slugify from "slugify";

const slugOptions = { lower: true, strict: true, trim: true };

export async function GET() {
  try {
    await connectDB();

    const products = await Product.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      products: products.map((p: any) => ({
        _id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        category: p.category,
        brandName: p.brandName,
        price: p.price,
        stock: p.stock,
        image: p.image,
        hoverImage: p.hoverImage,
        description: p.description,
        isActive: p.isActive,
      })),
    });
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

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

    if (!name || !category || !price || !image) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 🔥 Generate slug
    let baseSlug = slugify(name, slugOptions);
    let slug = baseSlug;

    let existing = await Product.findOne({ slug });
    let counter = 1;

    while (existing) {
      slug = `${baseSlug}-${counter}`;
      existing = await Product.findOne({ slug });
      counter++;
    }

    const product = await Product.create({
      name,
      slug,
      category,
      brandName,
      price: Number(price),
      stock: Number(stock || 0),
      image,
      hoverImage,
      description,
      isActive: isActive ?? true,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error("CREATE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}

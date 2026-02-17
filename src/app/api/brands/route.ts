import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Brand from "@/models/Brand";
import slugify from "slugify";

export async function GET() {
  try {
    await connectDB();

    const brands = await Brand.find().sort({ name: 1 }).lean();

    return NextResponse.json({
      brands: brands.map((b: any) => ({
        _id: b._id.toString(),
        name: b.name,
        slug: b.slug,
        image: b.image || "",
      })),
    });
  } catch (error) {
    console.error("GET BRANDS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const { name, image } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "Brand name required" },
        { status: 400 }
      );
    }

    const slug = slugify(name, { lower: true, strict: true });

    // Ensure uniqueness
    let existing = await Brand.findOne({ slug });
    let finalSlug = slug;
    let counter = 1;

    while (existing) {
      finalSlug = `${slug}-${counter}`;
      existing = await Brand.findOne({ slug: finalSlug });
      counter++;
    }

    const brand = await Brand.create({
      name,
      slug: finalSlug,
      image: image || "",
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error: any) {
    console.error("CREATE BRAND ERROR:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create brand" },
      { status: 500 }
    );
  }
}

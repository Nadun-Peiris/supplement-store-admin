import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Brand from "@/models/Brand";
import slugify from "slugify";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

const slugOptions = { lower: true, strict: true, trim: true };
type BrandListItem = {
  _id: { toString(): string };
  name?: string;
  slug?: string;
  image?: string;
};

export async function GET(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const brands = (await Brand.find().sort({ name: 1 }).lean()) as BrandListItem[];

    return NextResponse.json({
      brands: brands.map((b) => ({
        _id: b._id.toString(),
        name: b.name || "",
        slug: b.slug || "",
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
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const { name, image } = await req.json();
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      return NextResponse.json(
        { error: "Brand name required" },
        { status: 400 }
      );
    }

    const slug = slugify(normalizedName, slugOptions);

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
      name: normalizedName,
      slug: finalSlug,
      image: image || "",
    });

    return NextResponse.json(brand, { status: 201 });
  } catch (error: unknown) {
    console.error("CREATE BRAND ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create brand";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

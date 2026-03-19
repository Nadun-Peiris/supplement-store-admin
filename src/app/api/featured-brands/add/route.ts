import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import FeaturedBrand from "@/models/FeaturedBrand";

export async function POST(req: Request) {
  try {
    await connectDB();

    const { brandId } = await req.json();

    if (!brandId) {
      return NextResponse.json(
        { error: "Brand ID is required" },
        { status: 400 }
      );
    }

    const existing = await FeaturedBrand.findOne({ brandId });

    if (existing) {
      return NextResponse.json(
        { error: "Brand already featured" },
        { status: 400 }
      );
    }

    const count = await FeaturedBrand.countDocuments();

    if (count >= 8) {
      return NextResponse.json(
        { error: "Maximum of 8 featured brands allowed" },
        { status: 400 }
      );
    }

    const newFeatured = await FeaturedBrand.create({
      brandId,
      index: count,
    });

    return NextResponse.json(newFeatured, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to add featured brand" },
      { status: 500 }
    );
  }
}

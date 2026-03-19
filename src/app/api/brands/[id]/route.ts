import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Brand from "@/models/Brand";
import FeaturedBrand from "@/models/FeaturedBrand";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;
    const { name, image } = await req.json();

    const updated = await Brand.findByIdAndUpdate(
      id,
      { name, image },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update brand" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;

    const deleted = await Brand.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    const featuredEntry = await FeaturedBrand.findOneAndDelete({ brandId: id });

    if (featuredEntry && typeof featuredEntry.index === "number") {
      await FeaturedBrand.updateMany(
        { index: { $gt: featuredEntry.index } },
        { $inc: { index: -1 } }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}

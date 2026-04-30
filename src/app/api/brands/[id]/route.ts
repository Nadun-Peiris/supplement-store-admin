import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Brand from "@/models/Brand";
import FeaturedBrand from "@/models/FeaturedBrand";
import Product from "@/models/Product";
import slugify from "slugify";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

const slugOptions = { lower: true, strict: true, trim: true };

async function reindexFeaturedBrands() {
  const remaining = await FeaturedBrand.find().sort({ index: 1, createdAt: 1 });

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
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      return NextResponse.json(
        { error: "Brand name required" },
        { status: 400 }
      );
    }

    const existingBrand = await Brand.findById(id);

    if (!existingBrand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    const previousName = existingBrand.name;
    const previousSlug = existingBrand.slug || "";
    const baseSlug = slugify(normalizedName, slugOptions);
    let nextSlug = baseSlug;
    let existingSlugMatch = await Brand.findOne({
      slug: nextSlug,
      _id: { $ne: id },
    });
    let counter = 1;

    while (existingSlugMatch) {
      nextSlug = `${baseSlug}-${counter}`;
      existingSlugMatch = await Brand.findOne({
        slug: nextSlug,
        _id: { $ne: id },
      });
      counter++;
    }

    const updated = await Brand.findByIdAndUpdate(
      id,
      { name: normalizedName, slug: nextSlug, image: image || "" },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    if (previousName !== normalizedName || previousSlug !== nextSlug) {
      await Product.updateMany(
        {
          $or: [
            { brandName: previousName },
            { brandSlug: previousSlug },
          ],
        },
        {
          $set: {
            brandName: normalizedName,
            brandSlug: nextSlug,
          },
        }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("UPDATE BRAND ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update brand" },
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
    const brand = await Brand.findById(id);

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    const linkedProducts = await Product.countDocuments({
      $or: [
        { brandName: brand.name },
        { brandSlug: brand.slug },
      ],
    });

    if (linkedProducts > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete a brand that is still assigned to products",
        },
        { status: 409 }
      );
    }

    await Brand.findByIdAndDelete(id);
    await FeaturedBrand.deleteMany({ brandId: id });
    await reindexFeaturedBrands();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE BRAND ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}

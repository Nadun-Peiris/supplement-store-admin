import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import FeaturedBrand from "@/models/FeaturedBrand";
import "@/models/Brand";

type PopulatedFeaturedBrand = {
  _id: string | { toString(): string };
  index: number;
  brandId?:
    | {
        _id?: string | { toString(): string };
        name?: string;
        slug?: string;
        image?: string;
      }
    | string
    | null;
};

const normalizeId = (value?: string | { toString(): string } | null) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.toString?.() || "";
};

export async function GET() {
  try {
    await connectDB();

    const items = (await FeaturedBrand.find()
      .sort({ index: 1 })
      .limit(8)
      .populate("brandId")
      .lean()) as PopulatedFeaturedBrand[];

    const cleaned = items
      .map((item) => {
        const brandDoc =
          typeof item.brandId === "object" && item.brandId !== null
            ? item.brandId
            : null;
        const itemId = normalizeId(item._id);
        const brandId = normalizeId(brandDoc?._id);

        if (!brandId) return null;

        return {
          _id: itemId,
          index: item.index ?? 0,
          brandId,
          brand: {
            _id: brandId,
            name: brandDoc?.name || "",
            slug: brandDoc?.slug || "",
            image: brandDoc?.image || "",
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: cleaned });
  } catch (err) {
    console.error("GET FEATURED BRANDS ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import FeaturedCategory from "@/models/FeaturedCategory";
import "@/models/Category"; // ensure Category schema is registered for populate

type PopulatedFeaturedCategory = {
  _id: string | { toString(): string };
  index: number;
  categoryId?:
    | {
        _id?: string | { toString(): string };
        title?: string;
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

const firebaseBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const FALLBACK_IMAGE = "/file.svg";

const buildImageUrl = (raw?: string | null) => {
  if (!raw) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(raw)) return raw;

  const trimmed = raw.replace(/^\/+/, "");
  if (!trimmed) return FALLBACK_IMAGE;

  if (firebaseBucket) {
    const encoded = encodeURIComponent(trimmed);
    return `https://firebasestorage.googleapis.com/v0/b/${firebaseBucket}/o/${encoded}?alt=media`;
  }

  return `/${trimmed}`;
};

export async function GET() {
  try {
    await connectDB();

    const items = (await FeaturedCategory.find()
      .sort({ index: 1 })
      .populate("categoryId")
      .lean()) as PopulatedFeaturedCategory[];

    const cleaned = items.map((item) => {
      const categoryDoc =
        typeof item.categoryId === "object" && item.categoryId !== null
          ? item.categoryId
          : null;
      const itemId = normalizeId(item._id);
      const categoryId = normalizeId(categoryDoc?._id);

      return {
        _id: itemId,
        index: item.index ?? 0,
        categoryId,
        category: {
          _id: categoryId,
          name: categoryDoc?.title || categoryDoc?.name || "",
          slug: categoryDoc?.slug || "",
          image: buildImageUrl(categoryDoc?.image),
        },
      };
    });

    return NextResponse.json({ items: cleaned });
  } catch (err) {
    console.error("GET FEATURED ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

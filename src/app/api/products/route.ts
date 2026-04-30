import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product, { type ProductDocument } from "@/models/Product";
import slugify from "slugify";
import type { Types } from "mongoose";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

const slugOptions = { lower: true, strict: true, trim: true };
type ProductListItem = ProductDocument & { _id: Types.ObjectId };

type ProductInput = {
  name?: string;
  category?: string;
  brandName?: string;
  price?: number | string;
  discountPrice?: number | string | null;
  currency?: string;
  stock?: number | string;
  image?: string;
  hoverImage?: string;
  gallery?: unknown;
  description?: string;
  details?: {
    overview?: string;
    ingredients?: unknown;
    benefits?: unknown;
    howToUse?: unknown;
    warnings?: unknown;
    additionalInfo?: unknown;
    servingInfo?: {
      servingSize?: string;
      servingsPerContainer?: number | string;
      nutrients?: unknown;
      title?: string;
      amountPerServingLabel?: string;
      dailyValueLabel?: string;
      footnote?: string;
      ingredientsText?: string;
      containsText?: string;
      noticeText?: string;
    };
  };
  coa?: {
    certificateUrl?: string;
    verified?: boolean;
  };
  isActive?: boolean;
};

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const toNutrients = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          name: typeof item.name === "string" ? item.name.trim() : "",
          amount: typeof item.amount === "string" ? item.amount.trim() : "",
          dailyValue:
            typeof item.dailyValue === "string" ? item.dailyValue.trim() : "",
          indentLevel:
            typeof item.indentLevel === "number" ? item.indentLevel : 0,
          emphasized:
            typeof item.emphasized === "boolean" ? item.emphasized : false,
        }))
        .filter((item) => item.name)
    : [];

const buildDetails = (details?: ProductInput["details"]) => ({
  overview: details?.overview?.trim() || "",
  ingredients: toStringArray(details?.ingredients),
  benefits: toStringArray(details?.benefits),
  howToUse: toStringArray(details?.howToUse),
  warnings: toStringArray(details?.warnings),
  additionalInfo: toStringArray(details?.additionalInfo),
  servingInfo: {
    servingSize: details?.servingInfo?.servingSize?.trim() || "",
    servingsPerContainer: details?.servingInfo?.servingsPerContainer
      ? Number(details.servingInfo.servingsPerContainer)
      : undefined,
    nutrients: toNutrients(details?.servingInfo?.nutrients),
    title: details?.servingInfo?.title?.trim() || "Nutrition Facts",
    amountPerServingLabel:
      details?.servingInfo?.amountPerServingLabel?.trim() ||
      "Amount Per Serving",
    dailyValueLabel:
      details?.servingInfo?.dailyValueLabel?.trim() || "% Daily Value",
    footnote: details?.servingInfo?.footnote?.trim() || "",
    ingredientsText: details?.servingInfo?.ingredientsText?.trim() || "",
    containsText: details?.servingInfo?.containsText?.trim() || "",
    noticeText: details?.servingInfo?.noticeText?.trim() || "",
  },
});

const buildCoa = (coa?: ProductInput["coa"]) => ({
  certificateUrl: coa?.certificateUrl?.trim() || "",
  verified: coa?.verified ?? false,
});

export async function GET(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const products = await Product.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      products: products.map((p: ProductListItem) => ({
        _id: p._id.toString(),
        name: p.name,
        slug: p.slug,
        category: p.category,
        categorySlug: p.categorySlug,
        brandName: p.brandName,
        brandSlug: p.brandSlug,
        
        // Pricing
        price: p.price,
        discountPrice: p.discountPrice,
        currency: p.currency,
        
        stock: p.stock,
        
        // Images
        image: p.image,
        hoverImage: p.hoverImage,
        gallery: p.gallery || [],
        
        // Content & Details
        description: p.description,
        details: p.details || {},
        
        // Authenticity
        coa: p.coa || {},
        
        isActive: p.isActive,
        createdAt: p.createdAt,
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
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    await connectDB();

    const body = (await req.json()) as ProductInput;

    // Destructure all incoming fields, including the new nested ones
    const {
      name,
      category,
      brandName,
      price,
      discountPrice,
      currency,
      stock,
      image,
      hoverImage,
      gallery,
      description,
      details,
      coa,
      isActive,
    } = body;

    // Basic validation
    if (!name || !category || !price || !image) {
      return NextResponse.json(
        { error: "Missing required fields (name, category, price, image)" },
        { status: 400 }
      );
    }

    // 🔥 Generate unique slug
    const baseSlug = slugify(name, slugOptions);
    let slug = baseSlug;

    let existing = await Product.findOne({ slug });
    let counter = 1;

    while (existing) {
      slug = `${baseSlug}-${counter}`;
      existing = await Product.findOne({ slug });
      counter++;
    }

    // Create the product mapping all expanded fields
    const product = await Product.create({
      name,
      slug,
      category,
      brandName,
      
      // Pricing
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : undefined,
      currency: currency || "LKR",
      
      stock: Number(stock || 0),
      
      // Images
      image,
      hoverImage: hoverImage || "",
      gallery: toStringArray(gallery),
      
      // Content & Structured Details
      description,
      details: buildDetails(details),
      
      // Authenticity
      coa: buildCoa(coa),
      
      isActive: isActive ?? true,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    console.error("CREATE PRODUCT ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

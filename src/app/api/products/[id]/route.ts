import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";
import slugify from "slugify";

const slugOptions = { lower: true, strict: true, trim: true };
const toSlug = (value: string) => slugify(value, slugOptions);

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

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;
    const body = (await req.json()) as ProductInput;

    // Destructure all fields, including the new additions
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

    if (!name || !category || !price || !image) {
      return NextResponse.json(
        { error: "Missing required fields (name, category, price, image)" },
        { status: 400 }
      );
    }

    // Map fields to the update object
    const updateData: Record<string, unknown> = {
      name,
      category,
      categorySlug: toSlug(category),
      brandName,
      brandSlug: brandName ? toSlug(brandName) : "",
      
      // Pricing
      price: Number(price),
      // Use null to clear the discount price if the user removes it
      discountPrice: discountPrice ? Number(discountPrice) : null,
      currency: currency || "LKR",
      
      stock: Number(stock || 0),
      
      // Images
      image,
      hoverImage: hoverImage || "",
      gallery: toStringArray(gallery),
      
      // Content & Details
      description,
      details: buildDetails(details),
      
      // Authenticity
      coa: buildCoa(coa),
      
      isActive: isActive ?? true,
    };

    // 🔥 Regenerate slug if name changed
    const baseSlug = slugify(name, slugOptions);
    let slug = baseSlug;

    let existing = await Product.findOne({
      slug,
      _id: { $ne: id },
    });

    let counter = 1;

    while (existing) {
      slug = `${baseSlug}-${counter}`;
      existing = await Product.findOne({
        slug,
        _id: { $ne: id },
      });
      counter++;
    }

    updateData.slug = slug;

    const updated = await Product.findByIdAndUpdate(id, updateData, {
      new: true, // Returns the modified document rather than the original
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("UPDATE PRODUCT ERROR:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update product";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();

    const { id } = await params;

    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

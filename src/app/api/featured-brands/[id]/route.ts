import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import FeaturedBrand from "@/models/FeaturedBrand";

type ParamsPromise = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: ParamsPromise) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await req.json();
    const rawIndex = Number(body?.index);

    if (!Number.isInteger(rawIndex)) {
      return NextResponse.json(
        { error: "Invalid index value" },
        { status: 400 }
      );
    }

    const target = await FeaturedBrand.findById(id);

    if (!target) {
      return NextResponse.json(
        { error: "Featured brand not found" },
        { status: 404 }
      );
    }

    const total = await FeaturedBrand.countDocuments();
    const maxIndex = total - 1;
    const desiredIndex = Math.max(0, Math.min(maxIndex, rawIndex));

    if (target.index === desiredIndex) {
      return NextResponse.json({ success: true });
    }

    const oldIndex = target.index ?? 0;

    if (desiredIndex > oldIndex) {
      await FeaturedBrand.updateMany(
        { index: { $gt: oldIndex, $lte: desiredIndex } },
        { $inc: { index: -1 } }
      );
    } else {
      await FeaturedBrand.updateMany(
        { index: { $gte: desiredIndex, $lt: oldIndex } },
        { $inc: { index: 1 } }
      );
    }

    target.index = desiredIndex;
    await target.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("UPDATE FEATURED BRAND ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: ParamsPromise) {
  try {
    await connectDB();

    const { id } = await params;

    const maybeObjectId = mongoose.Types.ObjectId.isValid(id)
      ? new mongoose.Types.ObjectId(id)
      : null;

    let deleted = null;

    if (maybeObjectId) {
      deleted = await FeaturedBrand.findByIdAndDelete(maybeObjectId);

      if (!deleted) {
        deleted = await FeaturedBrand.findOneAndDelete({
          brandId: maybeObjectId,
        });
      }
    } else {
      deleted = await FeaturedBrand.findOneAndDelete({
        brandId: id,
      });
    }

    if (!deleted) {
      return NextResponse.json(
        { error: "Featured brand not found" },
        { status: 404 }
      );
    }

    if (typeof deleted.index === "number") {
      await FeaturedBrand.updateMany(
        { index: { $gt: deleted.index } },
        { $inc: { index: -1 } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE FEATURED BRAND ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

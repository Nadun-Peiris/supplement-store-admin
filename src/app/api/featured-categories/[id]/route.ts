import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";
import FeaturedCategory from "@/models/FeaturedCategory";

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

    const target = await FeaturedCategory.findById(id);

    if (!target) {
      return NextResponse.json(
        { error: "Featured category not found" },
        { status: 404 }
      );
    }

    const total = await FeaturedCategory.countDocuments();
    const maxIndex = total - 1;

    // 🔥 Index now starts from 0
    const desiredIndex = Math.max(0, Math.min(maxIndex, rawIndex));

    if (target.index === desiredIndex) {
      return NextResponse.json({ success: true });
    }

    const oldIndex = target.index ?? 0;

    if (desiredIndex > oldIndex) {
      await FeaturedCategory.updateMany(
        { index: { $gt: oldIndex, $lte: desiredIndex } },
        { $inc: { index: -1 } }
      );
    } else {
      await FeaturedCategory.updateMany(
        { index: { $gte: desiredIndex, $lt: oldIndex } },
        { $inc: { index: 1 } }
      );
    }

    target.index = desiredIndex;
    await target.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("UPDATE FEATURED ERROR", err);
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

    // 🔥 Keep your flexible delete logic
    if (maybeObjectId) {
      deleted = await FeaturedCategory.findByIdAndDelete(maybeObjectId);

      if (!deleted) {
        deleted = await FeaturedCategory.findOneAndDelete({
          categoryId: maybeObjectId,
        });
      }
    } else {
      deleted = await FeaturedCategory.findOneAndDelete({
        categoryId: id,
      });
    }

    if (!deleted) {
      return NextResponse.json(
        { error: "Featured category not found" },
        { status: 404 }
      );
    }

    // 🔥 Normalize indexes (no gaps)
    if (typeof deleted.index === "number") {
      await FeaturedCategory.updateMany(
        { index: { $gt: deleted.index } },
        { $inc: { index: -1 } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE FEATURED ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

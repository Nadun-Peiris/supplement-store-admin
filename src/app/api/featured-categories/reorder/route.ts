import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import FeaturedCategory from "@/models/FeaturedCategory";

type RawUpdate = string | { _id?: string; id?: string; index?: number; order?: number };

type NormalizedUpdate = { id: string; order: number };

const extractUpdates = (body: unknown): RawUpdate[] => {
  if (Array.isArray(body)) return body;
  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { updates?: RawUpdate[] }).updates)
  ) {
    return (body as { updates: RawUpdate[] }).updates;
  }
  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { items?: RawUpdate[] }).items)
  ) {
    return (body as { items: RawUpdate[] }).items;
  }
  return [];
};

const normalizeUpdates = (raw: RawUpdate[]): NormalizedUpdate[] => {
  const seen = new Set<string>();

  return raw
    .map((entry, idx) => {
      if (typeof entry === "string") {
        return { id: entry, order: idx };
      }

      if (!entry || typeof entry !== "object") return null;

      const id = entry._id || entry.id;
      if (!id) return null;

      const orderSource =
        typeof entry.index === "number"
          ? entry.index
          : typeof entry.order === "number"
          ? entry.order
          : idx;

      const order = Number(orderSource);
      if (!Number.isFinite(order)) return null;

      return { id, order };
    })
    .filter((item): item is NormalizedUpdate => {
      if (!item || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({
      id: item.id,
      order: idx + 1, // final sequential order starting at 1
    }));
};

export async function PUT(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const updates = normalizeUpdates(extractUpdates(body));

    if (!updates.length) {
      return NextResponse.json(
        { error: "No items supplied for reorder" },
        { status: 400 }
      );
    }

    const operations = updates.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { index: order } },
      },
    }));

    await FeaturedCategory.bulkWrite(operations, { ordered: false });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("REORDER FEATURED ERROR", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

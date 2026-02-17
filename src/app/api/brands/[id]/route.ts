import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Brand from "@/models/Brand";

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
  } catch (error) {
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

    await Brand.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete brand" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "supplement-store/categories",
    });

    return NextResponse.json({
      url: uploadResponse.secure_url,
    });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

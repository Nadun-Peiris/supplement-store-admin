import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { verifyAdmin } from "@/lib/server/verifyAdmin";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const guard = await verifyAdmin(req);
    if ("error" in guard) return guard.error;

    const body = await req.json();
    const { image } = body;

    if (typeof image !== "string" || !image.trim()) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }

    const normalizedImage = image.trim();
    const mimeMatch = normalizedImage.match(/^data:([^;]+);base64,/i);

    if (!mimeMatch || !ALLOWED_IMAGE_MIME_TYPES.has(mimeMatch[1].toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported image format" },
        { status: 400 }
      );
    }

    const base64Payload = normalizedImage.slice(normalizedImage.indexOf(",") + 1);
    const approximateBytes = Math.floor((base64Payload.length * 3) / 4);

    if (approximateBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds 5 MB upload limit" },
        { status: 400 }
      );
    }

    const uploadResponse = await cloudinary.uploader.upload(normalizedImage, {
      folder: "supplement-store/admin",
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

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/authorization";
import { env } from "@/lib/env";
import { rejectUntrustedOrigin } from "@/lib/request-security";
import { storeConfig } from "@/config/store";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const maxBytes = 4_000_000;

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }
  if (
    !env.CLOUDINARY_CLOUD_NAME ||
    !env.CLOUDINARY_API_KEY ||
    !env.CLOUDINARY_API_SECRET
  ) {
    return Response.json(
      { error: "Cloudinary is not configured." },
      { status: 503 },
    );
  }
  const body = await request.formData();
  const file = body.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Choose an image to upload." },
      { status: 400 },
    );
  }
  if (!allowedTypes.has(file.type)) {
    return Response.json(
      { error: "Use a JPEG, PNG, WebP, or AVIF image." },
      { status: 415 },
    );
  }
  if (file.size > maxBytes) {
    return Response.json(
      { error: "Images must be smaller than 4 MB." },
      { status: 413 },
    );
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: storeConfig.cloudinaryFolder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
      },
      (error, upload) => {
        if (error || !upload) {
          reject(error ?? new Error("Cloudinary returned no upload result."));
          return;
        }
        resolve(upload);
      },
    );
    stream.end(buffer);
  });

  return Response.json({
    secure_url: result.secure_url,
    public_id: result.public_id,
    width: result.width,
    height: result.height,
  });
}

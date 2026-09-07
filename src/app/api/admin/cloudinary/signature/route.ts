import { v2 as cloudinary } from "cloudinary";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/authorization";
import { env } from "@/lib/env";
import { storeConfig } from "@/config/store";
import { rejectUntrustedOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (!isAdminRole(session.user.role)) {
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
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = {
    timestamp,
    folder: storeConfig.cloudinaryFolder,
  };
  const signature = cloudinary.utils.api_sign_request(
    parameters,
    env.CLOUDINARY_API_SECRET,
  );
  return Response.json({
    signature,
    timestamp,
    folder: storeConfig.cloudinaryFolder,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
  });
}

export async function DELETE(request: Request) {
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
  const body: unknown = await request.json().catch(() => null);
  const publicId =
    body && typeof body === "object" && "publicId" in body
      ? body.publicId
      : null;
  if (typeof publicId !== "string" || !publicId.startsWith("lunaria/")) {
    return Response.json(
      { error: "Invalid image identifier." },
      { status: 400 },
    );
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const result = await cloudinary.uploader.destroy(publicId, {
    invalidate: true,
  });
  if (result.result !== "ok" && result.result !== "not found") {
    return Response.json(
      { error: "Cloudinary deletion failed." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}

import { createHash } from "node:crypto";
import { z } from "zod";
import { ReviewStatus } from "@prisma/client";
import { requireDatabase } from "@/lib/db";
import { serviceReadiness } from "@/lib/env";
import { normalizeEmail } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/request-security";

const schema = z.object({
  productSlug: z.string().min(1).max(160),
  name: z.string().trim().min(2).max(100),
  email: z.email().transform(normalizeEmail),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(1500),
});

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (!serviceReadiness.database) {
    return Response.json(
      { error: "Review submission requires a configured database." },
      { status: 503 },
    );
  }
  const limit = await enforceRateLimit("contact", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json({ error: "Too many submissions." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Review the required fields." },
      { status: 400 },
    );
  }
  const database = requireDatabase();
  const product = await database.product.findUnique({
    where: { slug: parsed.data.productSlug },
    select: { id: true, status: true },
  });
  if (!product || product.status !== "ACTIVE") {
    return Response.json(
      { error: "This product is not available for review." },
      { status: 404 },
    );
  }
  await database.review.create({
    data: {
      productId: product.id,
      authorName: parsed.data.name,
      authorEmailHash: createHash("sha256")
        .update(parsed.data.email)
        .digest("hex"),
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      status: ReviewStatus.PENDING,
    },
  });
  return Response.json(
    { message: "Thank you. Your review is awaiting moderation." },
    { status: 201 },
  );
}

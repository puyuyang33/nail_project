import { z } from "zod";
import { NewsletterStatus } from "@prisma/client";
import { requireDatabase } from "@/lib/db";
import { serviceReadiness } from "@/lib/env";
import { normalizeEmail } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/request-security";

const schema = z.object({
  email: z.email().transform(normalizeEmail),
  locale: z.enum(["en", "zh"]).default("en"),
});

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (!serviceReadiness.database) {
    return Response.json(
      { error: "Newsletter storage requires a configured database." },
      { status: 503 },
    );
  }
  const limit = await enforceRateLimit("contact", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json(
      { error: "Please wait before trying again." },
      { status: 429 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const database = requireDatabase();
  await database.newsletterSubscription.upsert({
    where: { emailNormalized: parsed.data.email },
    update: {
      email: parsed.data.email,
      locale: parsed.data.locale,
      status: NewsletterStatus.ACTIVE,
      consentedAt: new Date(),
      unsubscribedAt: null,
    },
    create: {
      email: parsed.data.email,
      emailNormalized: parsed.data.email,
      locale: parsed.data.locale,
      status: NewsletterStatus.ACTIVE,
      source: "website-footer",
      consentText: "Requested email marketing subscription.",
      consentedAt: new Date(),
      confirmedAt: new Date(),
    },
  });
  return Response.json({ ok: true });
}

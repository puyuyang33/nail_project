import { WholesaleApplicationStatus } from "@prisma/client";
import { inquirySchema } from "@/features/validation/schemas";
import { requireDatabase } from "@/lib/db";
import { env, serviceReadiness } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { normalizeEmail } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const body: unknown = await request.json().catch(() => null);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Review the required fields and try again." },
      { status: 400 },
    );
  }
  const limit = await enforceRateLimit(
    parsed.data.type === "wholesale" ? "wholesale" : "contact",
    getClientIdentifier(request),
  );
  if (!limit.success) {
    return Response.json(
      { error: "Too many messages. Please wait before trying again." },
      { status: 429 },
    );
  }

  if (parsed.data.type === "wholesale") {
    if (!serviceReadiness.database) {
      return Response.json(
        { error: "Wholesale applications require a configured database." },
        { status: 503 },
      );
    }
    const database = requireDatabase();
    await database.wholesaleApplication.create({
      data: {
        businessName: parsed.data.company ?? parsed.data.name,
        contactName: parsed.data.name,
        email: parsed.data.email,
        emailNormalized: normalizeEmail(parsed.data.email),
        phone: parsed.data.phone || null,
        website: parsed.data.website || null,
        countryCode: "US",
        message: parsed.data.message,
        status: WholesaleApplicationStatus.PENDING,
      },
    });
    return Response.json({ ok: true }, { status: 201 });
  }

  const recipient = env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? env.EMAIL_FROM;
  if (!recipient) {
    return Response.json(
      { error: "Contact email delivery is not configured." },
      { status: 503 },
    );
  }
  await sendEmail({
    to: recipient,
    subject: `Website enquiry from ${parsed.data.name}`,
    html: `<p>From: ${escapeHtml(parsed.data.name)} (${escapeHtml(parsed.data.email)})</p><p>${escapeHtml(parsed.data.message)}</p>`,
  });
  return Response.json({ ok: true });
}

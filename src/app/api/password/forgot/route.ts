import { z } from "zod";
import { addHours } from "date-fns";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { normalizeEmail } from "@/lib/normalize";
import { createSecureToken } from "@/lib/tokens";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/request-security";

const schema = z.object({
  email: z.email().transform(normalizeEmail),
  locale: z.enum(["en", "zh"]).default("en"),
});

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const limit = await enforceRateLimit("login", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json(
      { error: "Too many attempts. Please wait before trying again." },
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
  const generic = {
    message: "If that account exists, a secure reset link is on its way.",
  };

  try {
    const database = requireDatabase();
    const user = await database.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (!user) return Response.json(generic);

    const { token, hash } = createSecureToken();
    await database.verificationToken.deleteMany({
      where: { identifier: `password:${parsed.data.email}` },
    });
    await database.verificationToken.create({
      data: {
        identifier: `password:${parsed.data.email}`,
        token: hash,
        expires: addHours(new Date(), 1),
      },
    });
    const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/reset-password?token=${token}`;
    const delivery = await sendEmail({
      to: parsed.data.email,
      subject: "Reset your Lunaria password",
      html: `<p>A password reset was requested for your Lunaria account.</p><p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in one hour. Ignore this message if you did not request it.</p>`,
    });
    if (!delivery.delivered) {
      return Response.json(
        { error: "Email delivery is not configured." },
        { status: 503 },
      );
    }
    return Response.json(generic);
  } catch {
    return Response.json(
      { error: "Password recovery is temporarily unavailable." },
      { status: 503 },
    );
  }
}

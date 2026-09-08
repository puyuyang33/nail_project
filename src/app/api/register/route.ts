import { hash } from "bcryptjs";
import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { requireDatabase } from "@/lib/db";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/normalize";
import { rejectUntrustedOrigin } from "@/lib/request-security";
import { env } from "@/lib/env";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform(normalizeEmail),
  password: z
    .string()
    .min(12)
    .max(200)
    .regex(/[A-Za-z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/),
  locale: z.enum(["en", "zh"]).default("en"),
});

export async function POST(request: Request) {
  if (!env.AUTH_PASSWORD_REGISTRATION_ENABLED) {
    return Response.json(
      { error: "Password registration is disabled. Use Google sign-in." },
      { status: 404 },
    );
  }
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const limit = await enforceRateLimit("login", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429 },
    );
  }

  const parsed = registerSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Review your name, email, and password requirements." },
      { status: 400 },
    );
  }

  try {
    const database = requireDatabase();
    const existing = await database.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    const passwordHash = await hash(parsed.data.password, 12);
    await database.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          preferredLocale: parsed.data.locale,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
      });
      await Promise.all([
        tx.order.updateMany({
          where: {
            userId: null,
            emailNormalized: parsed.data.email,
          },
          data: { userId: user.id },
        }),
        tx.appointment.updateMany({
          where: {
            userId: null,
            emailNormalized: parsed.data.email,
          },
          data: { userId: user.id },
        }),
      ]);
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("not configured")
        ? error.message
        : "Account creation is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}

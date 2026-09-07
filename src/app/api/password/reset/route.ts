import { hash } from "bcryptjs";
import { z } from "zod";
import { requireDatabase } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/request-security";

const schema = z.object({
  token: z.string().min(32).max(200),
  password: z
    .string()
    .min(12)
    .max(200)
    .regex(/[A-Za-z]/)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/),
});

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const limit = await enforceRateLimit("login", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json({ error: "Too many attempts." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "The reset link or password is invalid." },
      { status: 400 },
    );
  }

  try {
    const database = requireDatabase();
    const tokenHash = hashToken(parsed.data.token);
    const record = await database.verificationToken.findUnique({
      where: { token: tokenHash },
    });
    if (
      !record ||
      !record.identifier.startsWith("password:") ||
      record.expires <= new Date()
    ) {
      return Response.json(
        { error: "This reset link is invalid or expired." },
        { status: 400 },
      );
    }
    const email = record.identifier.slice("password:".length);
    await database.$transaction([
      database.user.update({
        where: { email },
        data: { passwordHash: await hash(parsed.data.password, 12) },
      }),
      database.verificationToken.deleteMany({
        where: { identifier: record.identifier },
      }),
    ]);
    return Response.json({ message: "Password updated. You can now sign in." });
  } catch {
    return Response.json(
      { error: "Password reset is temporarily unavailable." },
      { status: 503 },
    );
  }
}

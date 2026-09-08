import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { UserRole, UserStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import {
  isGoogleAdminEmail,
  isVerifiedGoogleProfile,
} from "@/features/auth/google";

const credentialsSchema = z.object({
  email: z.email().transform(normalizeEmail),
  password: z.string().min(1).max(200),
});
const dummyPasswordHash =
  "$2b$12$8wshJGuVD6iknnmGixuEg.DIa3zOcBHnmK6Jth9j7q24c25R4jBfK";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/en/login",
  },
  providers: [
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID,
            clientSecret: env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                prompt: "select_account",
                access_type: "offline",
                response_type: "code",
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: "Password fallback",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!env.AUTH_CREDENTIALS_ENABLED) return null;
        const limit = await enforceRateLimit(
          "login",
          getClientIdentifier(request),
        );
        if (!limit.success) return null;
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        const passwordMatches = await compare(
          parsed.data.password,
          user?.passwordHash ?? dummyPasswordHash,
        );
        if (
          !user?.passwordHash ||
          user.status !== UserStatus.ACTIVE ||
          !passwordMatches
        ) {
          return null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && !isVerifiedGoogleProfile(profile)) {
        return false;
      }
      const existing = user.email
        ? await db.user.findUnique({
            where: { email: normalizeEmail(user.email) },
            select: { status: true },
          })
        : user.id
          ? await db.user.findUnique({
              where: { id: user.id },
              select: { status: true },
            })
          : null;
      return existing?.status !== UserStatus.DISABLED;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        const configuredRole = z.nativeEnum(UserRole).safeParse(user.role);
        const role =
          configuredRole.success && configuredRole.data === UserRole.SUPER_ADMIN
            ? UserRole.SUPER_ADMIN
            : isGoogleAdminEmail(user.email, env.AUTH_GOOGLE_ADMIN_EMAILS)
              ? UserRole.ADMIN
              : configuredRole.success
                ? configuredRole.data
                : UserRole.CUSTOMER;
        token.role = role;
        if (user.id && role === UserRole.ADMIN) {
          await db.user.updateMany({
            where: { id: user.id, role: { not: UserRole.SUPER_ADMIN } },
            data: { role: UserRole.ADMIN },
          });
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.userId === "string" ? token.userId : (token.sub ?? "");
        const role = z.nativeEnum(UserRole).safeParse(token.role);
        session.user.role = role.success ? role.data : UserRole.CUSTOMER;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) {
        await synchronizeGoogleUser(user.id, user.email);
      }
    },
    async signIn({ user }) {
      if (user.id) {
        const userId = user.id;
        const userEmail = user.email;
        await db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() },
          });
          if (userEmail) {
            await synchronizeGoogleUser(userId, userEmail, tx);
          }
        });
      }
    },
  },
});

async function synchronizeGoogleUser(
  userId: string,
  rawEmail: string,
  transaction?: Prisma.TransactionClient,
) {
  const database = transaction ?? db;
  const email = normalizeEmail(rawEmail);
  if (isGoogleAdminEmail(email, env.AUTH_GOOGLE_ADMIN_EMAILS)) {
    await database.user.updateMany({
      where: { id: userId, role: { not: UserRole.SUPER_ADMIN } },
      data: { role: UserRole.ADMIN },
    });
  }
  await Promise.all([
    database.order.updateMany({
      where: { userId: null, emailNormalized: email },
      data: { userId },
    }),
    database.appointment.updateMany({
      where: { userId: null, emailNormalized: email },
      data: { userId },
    }),
  ]);
}

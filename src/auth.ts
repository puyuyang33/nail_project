import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";

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
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
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
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
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
    async signIn({ user }) {
      if (user.id) {
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
    },
  },
});

import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

const fallbackConnection =
  "postgresql://lunaria:lunaria@127.0.0.1:5432/lunaria?schema=public";

const globalForPrisma = globalThis as unknown as {
  lunariaPrisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL || fallbackConnection,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.lunariaPrisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.lunariaPrisma = db;
}

export function requireDatabase() {
  if (!env.DATABASE_URL) {
    throw new Error(
      "Database service is not configured. Set DATABASE_URL and run migrations.",
    );
  }
  return db;
}

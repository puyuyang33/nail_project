import "dotenv/config";

import { defineConfig } from "prisma/config";

const localFallbackUrl =
  "postgresql://nail_store:local_development_only@127.0.0.1:5432/nail_store?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DIRECT_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      localFallbackUrl,
  },
});

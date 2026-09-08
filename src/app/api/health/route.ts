import { env, serviceReadiness } from "@/lib/env";

export function GET() {
  return Response.json({
    status: "ok",
    services: {
      ...serviceReadiness,
      documentStoreProvider: env.NOSQL_PROVIDER,
    },
    timestamp: new Date().toISOString(),
  });
}

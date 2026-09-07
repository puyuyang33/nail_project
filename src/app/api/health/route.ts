import { serviceReadiness } from "@/lib/env";

export function GET() {
  return Response.json({
    status: "ok",
    services: serviceReadiness,
    timestamp: new Date().toISOString(),
  });
}

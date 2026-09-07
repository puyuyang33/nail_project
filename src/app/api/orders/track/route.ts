import { trackingSchema } from "@/features/validation/schemas";
import { requireDatabase } from "@/lib/db";
import { serviceReadiness } from "@/lib/env";
import { normalizeContact } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!serviceReadiness.database) {
    return Response.json(
      { error: "Order tracking requires a configured database." },
      { status: 503 },
    );
  }
  const limit = await enforceRateLimit(
    "tracking",
    getClientIdentifier(request),
  );
  if (!limit.success) {
    return Response.json(
      { error: "Too many tracking attempts. Please wait and try again." },
      { status: 429 },
    );
  }
  const parsed = trackingSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Check the order number and contact information." },
      { status: 400 },
    );
  }
  const database = requireDatabase();
  const contact = normalizeContact(parsed.data.contact);
  const order = await database.order.findFirst({
    where: {
      orderNumber: parsed.data.orderNumber,
      OR: [{ emailNormalized: contact }, { phoneNormalized: contact }],
    },
    select: {
      orderNumber: true,
      status: true,
      updatedAt: true,
      shipments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { trackingUrl: true },
      },
    },
  });
  if (!order) {
    return Response.json(
      { error: "No matching order was found." },
      { status: 404 },
    );
  }
  return Response.json({
    orderNumber: order.orderNumber,
    status: order.status.replaceAll("_", " ").toLowerCase(),
    updatedAt: order.updatedAt,
    trackingUrl: order.shipments[0]?.trackingUrl ?? undefined,
  });
}

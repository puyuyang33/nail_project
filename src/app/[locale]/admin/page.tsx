import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";

export default async function AdminDashboard({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  await requireAdmin(locale as Locale);
  const database = requireDatabase();
  const [
    products,
    orders,
    appointments,
    pendingRequests,
    customers,
    lowStock,
    latestOrders,
  ] = await Promise.all([
    database.product.count({ where: { status: "ACTIVE" } }),
    database.order.count(),
    database.appointment.count(),
    database.appointment.count({ where: { status: "PENDING" } }),
    database.user.count({ where: { role: "CUSTOMER" } }),
    database.inventory.count({
      where: { quantityOnHand: { lte: 5 } },
    }),
    database.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotal: true,
        currency: true,
      },
    }),
  ]);
  const metrics = [
    ["Active products", products],
    ["Orders", orders],
    ["Appointments", appointments],
    ["Requests awaiting approval", pendingRequests],
    ["Customers", customers],
    ["Low-stock variants", lowStock],
  ];

  return (
    <div>
      <p className="eyebrow text-wine">Live operations</p>
      <h1 className="display mt-4 text-6xl">Dashboard</h1>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label} className="bg-porcelain border border-black/15 p-5">
            <p className="text-xs text-black/45">{label}</p>
            <p className="display mt-3 text-4xl">{value}</p>
          </div>
        ))}
      </div>
      <section className="bg-porcelain mt-10 border border-black/15 p-6">
        <h2 className="display text-3xl">Latest orders</h2>
        <div className="mt-5 divide-y divide-black/10">
          {latestOrders.map((order) => (
            <div
              key={order.id}
              className="flex justify-between gap-4 py-4 text-sm"
            >
              <strong>{order.orderNumber}</strong>
              <span>{order.status.replaceAll("_", " ")}</span>
              <span>
                {order.currency} {Number(order.grandTotal).toFixed(2)}
              </span>
            </div>
          ))}
          {!latestOrders.length && (
            <p className="py-5 text-sm text-black/45">No orders yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

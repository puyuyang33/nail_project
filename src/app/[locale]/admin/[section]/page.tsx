import { AppointmentStatus, OrderStatus, ReviewStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import {
  updateAppointmentStatus,
  updateOrderStatus,
  updateReviewStatus,
  rescheduleAppointment,
} from "../actions";
import { env } from "@/lib/env";

const sectionNames = {
  inventory: "Inventory",
  orders: "Orders",
  appointments: "Appointments",
  services: "Services",
  customers: "Customers",
  collections: "Collections",
  categories: "Categories",
  staff: "Nail artists & staff",
  schedules: "Schedules & blocked time",
  discounts: "Discounts",
  reviews: "Review moderation",
  wholesale: "Wholesale applications",
  newsletter: "Newsletter subscribers",
  content: "Homepage content",
  banners: "Promotional banners",
  settings: "Store configuration",
  analytics: "Analytics",
} as const;

export default async function AdminSectionPage({
  params,
}: PageProps<"/[locale]/admin/[section]">) {
  const { locale, section } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  if (!(section in sectionNames)) notFound();
  const title = sectionNames[section as keyof typeof sectionNames];

  return (
    <div>
      <p className="eyebrow text-wine">Administration</p>
      <h1 className="display mt-4 text-6xl">{title}</h1>
      <div className="mt-9">
        <SectionContent section={section} locale={safeLocale} />
      </div>
    </div>
  );
}

async function SectionContent({
  section,
  locale,
}: {
  section: string;
  locale: Locale;
}) {
  const database = requireDatabase();

  if (section === "orders") {
    const orders = await database.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <AdminTable
        headings={["Order", "Customer", "Total", "Status"]}
        rows={orders.map((order) => [
          order.orderNumber,
          order.customerNameSnapshot,
          `${order.currency} ${Number(order.grandTotal).toFixed(2)}`,
          <form
            action={updateOrderStatus}
            key={order.id}
            className="flex gap-2"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={order.id} />
            <select
              className="field !min-h-9 !py-1"
              name="status"
              defaultValue={order.status}
            >
              {Object.values(OrderStatus).map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <button className="border border-black/20 px-3 text-xs">
              Save
            </button>
          </form>,
        ])}
      />
    );
  }

  if (section === "appointments") {
    const appointments = await database.appointment.findMany({
      orderBy: { startAt: "desc" },
      take: 100,
      include: { staff: true },
    });
    return (
      <AdminTable
        headings={[
          "Reference",
          "Client / service",
          "Start / reschedule",
          "Status",
        ]}
        rows={appointments.map((appointment) => [
          appointment.confirmationNumber,
          `${appointment.customerNameSnapshot} · ${appointment.serviceNameSnapshot}`,
          <form
            action={rescheduleAppointment}
            key={`time-${appointment.id}`}
            className="grid gap-2"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={appointment.id} />
            <input
              className="field !min-h-9 !py-1"
              type="datetime-local"
              name="localStart"
              defaultValue={formatInTimeZone(
                appointment.startAt,
                env.BUSINESS_TIMEZONE,
                "yyyy-MM-dd'T'HH:mm",
              )}
              required
            />
            <button className="w-fit border border-black/20 px-3 py-2 text-xs">
              Reschedule
            </button>
          </form>,
          <form
            action={updateAppointmentStatus}
            key={appointment.id}
            className="flex gap-2"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={appointment.id} />
            <select
              className="field !min-h-9 !py-1"
              name="status"
              defaultValue={appointment.status}
            >
              {Object.values(AppointmentStatus).map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <button className="border border-black/20 px-3 text-xs">
              Save
            </button>
          </form>,
        ])}
      />
    );
  }

  if (section === "inventory") {
    const inventory = await database.inventory.findMany({
      include: {
        variant: { include: { product: { include: { translations: true } } } },
      },
      orderBy: { quantityOnHand: "asc" },
    });
    return (
      <AdminTable
        headings={["Product / variant", "SKU", "On hand", "Reserved"]}
        rows={inventory.map((stock) => [
          `${stock.variant.product.translations.find((item) => item.locale === "en")?.name ?? stock.variant.product.slug} · ${stock.variant.name}`,
          stock.variant.sku,
          stock.quantityOnHand,
          stock.quantityReserved,
        ])}
      />
    );
  }

  if (section === "services") {
    const services = await database.service.findMany({
      include: {
        translations: { where: { locale: "en" }, take: 1 },
        staff: true,
      },
      orderBy: { position: "asc" },
    });
    return (
      <AdminTable
        headings={["Service", "Duration", "Price", "Artists"]}
        rows={services.map((service) => [
          service.translations[0]?.name ?? service.slug,
          `${service.durationMinutes} minutes`,
          `${service.currency} ${Number(service.basePrice).toFixed(2)}`,
          service.staff.length,
        ])}
      />
    );
  }

  if (section === "customers") {
    const customers = await database.user.findMany({
      where: { role: "CUSTOMER" },
      include: { _count: { select: { orders: true, appointments: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <AdminTable
        headings={["Customer", "Email", "Orders", "Appointments"]}
        rows={customers.map((customer) => [
          customer.name ?? "Unnamed",
          customer.email ?? "No email",
          customer._count.orders,
          customer._count.appointments,
        ])}
      />
    );
  }

  if (section === "collections" || section === "categories") {
    const records =
      section === "collections"
        ? await database.collection.findMany({
            include: {
              translations: { where: { locale: "en" }, take: 1 },
              _count: { select: { products: true } },
            },
            orderBy: { position: "asc" },
          })
        : await database.category.findMany({
            include: {
              translations: { where: { locale: "en" }, take: 1 },
              _count: { select: { products: true } },
            },
            orderBy: { position: "asc" },
          });
    return (
      <AdminTable
        headings={["Name", "Slug", "Products", "Active"]}
        rows={records.map((record) => [
          record.translations[0]?.name ?? record.slug,
          record.slug,
          record._count.products,
          record.isActive ? "Yes" : "No",
        ])}
      />
    );
  }

  if (section === "staff" || section === "schedules") {
    const staff = await database.staffMember.findMany({
      include: {
        _count: {
          select: { services: true, availability: true, appointments: true },
        },
      },
      orderBy: { position: "asc" },
    });
    return (
      <AdminTable
        headings={[
          "Staff member",
          "Services",
          "Availability rules",
          "Appointments",
        ]}
        rows={staff.map((member) => [
          member.displayName,
          member._count.services,
          member._count.availability,
          member._count.appointments,
        ])}
      />
    );
  }

  if (section === "discounts") {
    const discounts = await database.discount.findMany({
      orderBy: { createdAt: "desc" },
    });
    return (
      <AdminTable
        headings={["Code", "Type", "Usage", "Active"]}
        rows={discounts.map((discount) => [
          discount.code,
          discount.type,
          `${discount.usageCount}${discount.usageLimit ? ` / ${discount.usageLimit}` : ""}`,
          discount.isActive ? "Yes" : "No",
        ])}
      />
    );
  }

  if (section === "reviews") {
    const reviews = await database.review.findMany({
      include: { product: { include: { translations: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <AdminTable
        headings={["Product", "Author", "Rating", "Status"]}
        rows={reviews.map((review) => [
          review.product.translations.find((item) => item.locale === "en")
            ?.name ?? review.product.slug,
          review.authorName,
          `${review.rating} / 5`,
          <form
            action={updateReviewStatus}
            key={review.id}
            className="flex gap-2"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={review.id} />
            <select
              className="field !min-h-9 !py-1"
              name="status"
              defaultValue={review.status}
            >
              {Object.values(ReviewStatus).map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <button className="border border-black/20 px-3 text-xs">
              Save
            </button>
          </form>,
        ])}
      />
    );
  }

  if (section === "wholesale") {
    const applications = await database.wholesaleApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <AdminTable
        headings={["Business", "Contact", "Country", "Status"]}
        rows={applications.map((application) => [
          application.businessName,
          `${application.contactName} · ${application.email}`,
          application.countryCode,
          application.status,
        ])}
      />
    );
  }

  if (section === "newsletter") {
    const subscribers = await database.newsletterSubscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <AdminTable
        headings={["Email", "Locale", "Status", "Joined"]}
        rows={subscribers.map((subscriber) => [
          subscriber.email,
          subscriber.locale,
          subscriber.status,
          subscriber.createdAt.toLocaleDateString(),
        ])}
      />
    );
  }

  if (
    section === "settings" ||
    section === "content" ||
    section === "banners"
  ) {
    const settings = await database.storeSetting.findMany({
      where:
        section === "settings"
          ? undefined
          : { category: section === "content" ? "content" : "promotion" },
      orderBy: [{ category: "asc" }, { key: "asc" }],
    });
    return (
      <AdminTable
        headings={["Category", "Key", "Visibility", "Updated"]}
        rows={settings.map((setting) => [
          setting.category,
          setting.key,
          setting.isPublic ? "Public" : "Private",
          setting.updatedAt.toLocaleDateString(),
        ])}
      />
    );
  }

  if (section === "analytics") {
    const paid = await database.order.aggregate({
      where: { paymentStatus: "SUCCEEDED" },
      _sum: { grandTotal: true },
      _count: true,
    });
    const completed = await database.appointment.aggregate({
      where: { status: "COMPLETED" },
      _sum: { priceSnapshot: true },
      _count: true,
    });
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric
          label="Paid order revenue"
          value={`$${Number(paid._sum.grandTotal ?? 0).toFixed(2)}`}
          note={`${paid._count} paid orders`}
        />
        <Metric
          label="Completed service revenue"
          value={`$${Number(completed._sum.priceSnapshot ?? 0).toFixed(2)}`}
          note={`${completed._count} completed appointments`}
        />
      </div>
    );
  }

  notFound();
}

function AdminTable({
  headings,
  rows,
}: {
  headings: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <div className="bg-porcelain overflow-x-auto border border-black/15">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-b border-black/15 text-xs tracking-wider uppercase">
          <tr>
            {headings.map((heading) => (
              <th className="p-4" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/10">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td className="p-4" key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="p-6 text-sm text-black/45">No records yet.</p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-porcelain border border-black/15 p-7">
      <p className="eyebrow text-black/45">{label}</p>
      <p className="display mt-4 text-5xl">{value}</p>
      <p className="mt-2 text-xs text-black/45">{note}</p>
    </div>
  );
}

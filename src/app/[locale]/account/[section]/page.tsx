import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { addAddress, updateProfile } from "../actions";

const sections = {
  profile: {
    title: "Profile",
    copy: "Manage your contact information and communication preferences.",
  },
  orders: {
    title: "Orders",
    copy: "Your authenticated order history appears here after checkout.",
  },
  appointments: {
    title: "Appointments",
    copy: "Review upcoming and past studio visits from one private place.",
  },
  addresses: {
    title: "Saved addresses",
    copy: "Save delivery details for a faster future checkout.",
  },
} as const;

export default async function AccountSectionPage({
  params,
}: PageProps<"/[locale]/account/[section]">) {
  const { section } = await params;
  if (!(section in sections)) notFound();
  const content = sections[section as keyof typeof sections];
  const { locale } = await params;
  const safeLocale = locale as Locale;
  const user = await requireUser(safeLocale);
  const database = requireDatabase();
  const orders =
    section === "orders"
      ? await database.order.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : [];
  const appointments =
    section === "appointments"
      ? await database.appointment.findMany({
          where: { userId: user.id },
          orderBy: { startAt: "desc" },
          take: 25,
        })
      : [];
  const addresses =
    section === "addresses"
      ? await database.address.findMany({
          where: { userId: user.id },
          orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
        })
      : [];

  return (
    <div className="container-shell py-14 md:py-24">
      <p className="eyebrow text-wine">Private account</p>
      <h1 className="display mt-5 text-7xl tracking-[-0.05em]">
        {content.title}
      </h1>
      <div className="bg-porcelain mt-10 max-w-2xl border border-black/15 p-8">
        <p className="leading-7 text-black/58">{content.copy}</p>
        {section === "profile" && (
          <form action={updateProfile} className="mt-7 grid gap-5">
            <input type="hidden" name="locale" value={safeLocale} />
            <AccountField
              label="Full name"
              name="name"
              defaultValue={user.name ?? ""}
            />
            <AccountField
              label="Email"
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
            />
            <AccountField label="Phone" name="phone" defaultValue="" />
            <button className="button-primary w-fit">Save profile</button>
          </form>
        )}
        {section === "orders" && (
          <div className="mt-7 divide-y divide-black/10 border-y border-black/10">
            {orders.length ? (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <span>
                    <strong>{order.orderNumber}</strong>
                    <span className="mt-1 block text-xs text-black/45">
                      {order.createdAt.toLocaleDateString()}
                    </span>
                  </span>
                  <span className="text-right">
                    {order.status.replaceAll("_", " ")}
                    <span className="mt-1 block font-bold">
                      {order.currency} {Number(order.grandTotal).toFixed(2)}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm text-black/45">
                No linked orders yet.
              </p>
            )}
          </div>
        )}
        {section === "appointments" && (
          <div className="mt-7 divide-y divide-black/10 border-y border-black/10">
            {appointments.length ? (
              appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <span>
                    <strong>{appointment.serviceNameSnapshot}</strong>
                    <span className="mt-1 block text-xs text-black/45">
                      {appointment.confirmationNumber}
                    </span>
                  </span>
                  <span className="text-right">
                    {appointment.startAt.toLocaleString()}
                    <span className="mt-1 block text-xs">
                      {appointment.status.replaceAll("_", " ")}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <p className="py-6 text-sm text-black/45">
                No linked appointments yet.
              </p>
            )}
          </div>
        )}
        {section === "addresses" && (
          <>
            <div className="mt-7 grid gap-3">
              {addresses.map((address) => (
                <address
                  key={address.id}
                  className="border border-black/10 p-4 text-sm leading-6 not-italic"
                >
                  <strong>{address.label}</strong>
                  <br />
                  {address.recipientName}, {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  <br />
                  {address.city}, {address.region} {address.postalCode},{" "}
                  {address.countryCode}
                </address>
              ))}
            </div>
            <form
              action={addAddress}
              className="mt-8 grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="locale" value={safeLocale} />
              <AccountField label="Label" name="label" defaultValue="Home" />
              <AccountField label="Recipient" name="recipientName" />
              <div className="sm:col-span-2">
                <AccountField label="Street address" name="line1" />
              </div>
              <div className="sm:col-span-2">
                <AccountField
                  label="Apartment / suite"
                  name="line2"
                  required={false}
                />
              </div>
              <AccountField label="City" name="city" />
              <AccountField label="State / region" name="region" />
              <AccountField label="Postal code" name="postalCode" />
              <AccountField
                label="Country code"
                name="countryCode"
                defaultValue="US"
              />
              <button className="button-primary w-fit sm:col-span-2">
                Add address
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function AccountField({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        className="field"
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </label>
  );
}

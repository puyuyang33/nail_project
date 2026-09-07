import {
  CalendarDays,
  Heart,
  MapPin,
  PackageOpen,
  UserRound,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";

const links = [
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/orders", label: "Orders", icon: PackageOpen },
  { href: "/account/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
] as const;

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  const user = await requireUser(locale as Locale);
  const database = requireDatabase();
  const [orders, appointments, addresses] = await Promise.all([
    database.order.count({ where: { userId: user.id } }),
    database.appointment.count({ where: { userId: user.id } }),
    database.address.count({ where: { userId: user.id } }),
  ]);
  const counts: Record<string, number | undefined> = {
    "/account/orders": orders,
    "/account/appointments": appointments,
    "/account/addresses": addresses,
  };

  return (
    <div className="container-shell py-14 md:py-24">
      <p className="eyebrow text-wine">Your private archive</p>
      <h1 className="display mt-5 text-7xl tracking-[-0.05em]">
        Welcome, {user.name?.split(" ")[0] ?? "friend"}.
      </h1>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(({ href, label, icon: Icon }, index) => (
          <Link
            href={href}
            key={href}
            className="group bg-porcelain hover:bg-acid border border-black/15 p-7 transition-colors"
          >
            <div className="flex items-start justify-between">
              <Icon size={22} strokeWidth={1.4} />
              <span className="eyebrow text-black/35">0{index + 1}</span>
            </div>
            <h2 className="display mt-12 text-3xl">{label}</h2>
            {counts[href] !== undefined && (
              <p className="mt-2 text-xs text-black/45">{counts[href]} saved</p>
            )}
          </Link>
        ))}
      </div>
      <p className="mt-8 max-w-xl text-sm leading-6 text-black/55">
        Your private archive keeps orders, appointments, addresses, and saved
        objects together. Guest checkout and booking remain available without an
        account.
      </p>
    </div>
  );
}

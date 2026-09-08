import {
  Boxes,
  CalendarRange,
  ContactRound,
  ChartNoAxesCombined,
  LayoutDashboard,
  ListTree,
  PackageOpen,
  Settings2,
  ShoppingBag,
  Star,
  Tags,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/authorization";
import { signOut } from "@/auth";

export const metadata: Metadata = {
  title: "Atelier console",
  robots: { index: false, follow: false },
};

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: ShoppingBag },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/orders", label: "Orders", icon: PackageOpen },
  { href: "/admin/calendar", label: "Team calendar", icon: CalendarRange },
  { href: "/admin/staff", label: "Workers", icon: ContactRound },
  { href: "/admin/services", label: "Services", icon: Star },
  { href: "/admin/customers", label: "Customers", icon: UsersRound },
  { href: "/admin/collections", label: "Collections", icon: Tags },
  { href: "/admin/categories", label: "Categories", icon: ListTree },
  { href: "/admin/wholesale", label: "Wholesale", icon: UsersRound },
  { href: "/admin/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
] as const;

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  const user = await requireAdmin(safeLocale);
  const logout = async () => {
    "use server";
    await signOut({ redirectTo: `/${safeLocale}` });
  };

  return (
    <div className="container-shell grid gap-8 py-8 lg:grid-cols-[15rem_1fr]">
      <aside className="bg-ink text-paper h-fit border border-black/15 p-5 lg:sticky lg:top-28">
        <p className="eyebrow text-acid">Atelier console</p>
        <p className="text-paper/55 mt-3 truncate text-sm">{user.email}</p>
        <nav className="mt-7" aria-label="Administration">
          <ul className="space-y-1">
            {adminNav.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="hover:text-acid flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-white/10"
                >
                  <Icon size={16} strokeWidth={1.5} /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={logout} className="mt-7 border-t border-white/15 pt-5">
          <button className="text-paper/55 hover:text-acid text-xs">
            Sign out
          </button>
        </form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

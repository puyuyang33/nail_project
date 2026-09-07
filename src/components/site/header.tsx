"use client";

import {
  CalendarDays,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { storeConfig } from "@/config/store";
import { useStore } from "@/components/store/store-provider";
import { LanguageSwitcher } from "./language-switcher";

const navItems = [
  { href: "/shop", key: "shop" },
  { href: "/collections", key: "collections" },
  { href: "/services", key: "services" },
  { href: "/about", key: "about" },
] as const;

export function SiteHeader() {
  const t = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const { cartCount, wishlist } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="bg-ink text-paper px-4 py-2 text-center text-[0.65rem] font-bold tracking-[0.16em] uppercase">
        {storeConfig.announcement[locale]}
      </div>
      <header className="bg-paper/90 sticky top-0 z-50 border-b border-black/10 backdrop-blur-xl">
        <div className="container-shell flex h-[4.5rem] items-center justify-between gap-4">
          <button
            type="button"
            className="grid size-10 place-items-center lg:hidden"
            aria-label={open ? t("close") : t("menu")}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>

          <nav aria-label="Primary navigation" className="hidden lg:block">
            <ul className="flex items-center gap-7">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-wine text-[0.68rem] font-bold tracking-[0.14em] uppercase transition-colors"
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <Link
            href="/"
            className="display absolute left-1/2 -translate-x-1/2 text-[1.7rem] leading-none font-semibold tracking-[-0.03em]"
            aria-label={`${storeConfig.name} home`}
          >
            Lunaria
            <span className="bg-wine ml-1 inline-block size-2 rounded-full align-top" />
          </Link>

          <div className="ml-auto flex items-center gap-1 sm:gap-3">
            <div className="hidden xl:block">
              <LanguageSwitcher />
            </div>
            <HeaderIcon href="/search" label={t("search")}>
              <Search />
            </HeaderIcon>
            <HeaderIcon
              href="/account/wishlist"
              label={`${t("wishlist")} (${wishlist.length})`}
              className="hidden sm:grid"
            >
              <Heart />
            </HeaderIcon>
            <HeaderIcon
              href="/account"
              label={t("account")}
              className="hidden sm:grid"
            >
              <UserRound />
            </HeaderIcon>
            <HeaderIcon
              href="/book"
              label={t("book")}
              className="hidden md:grid"
            >
              <CalendarDays />
            </HeaderIcon>
            <HeaderIcon href="/cart" label={`${t("cart")} (${cartCount})`}>
              <ShoppingBag />
              {cartCount > 0 && (
                <span className="bg-wine absolute top-0 right-0 grid size-4 place-items-center rounded-full text-[0.55rem] text-white">
                  {cartCount}
                </span>
              )}
            </HeaderIcon>
          </div>
        </div>

        {open && (
          <div
            id="mobile-navigation"
            className="bg-paper absolute inset-x-0 top-full min-h-[calc(100vh-6rem)] border-t border-black/10 p-6 lg:hidden"
          >
            <nav aria-label="Mobile navigation">
              <ul className="divide-y divide-black/10">
                {navItems.map((item, index) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="display flex items-center justify-between py-5 text-3xl"
                    >
                      <span>{t(item.key)}</span>
                      <span className="font-sans text-[0.65rem] tracking-widest">
                        0{index + 1}
                      </span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/book"
                    onClick={() => setOpen(false)}
                    className="display text-wine flex items-center justify-between py-5 text-3xl"
                  >
                    {t("book")}
                    <CalendarDays size={20} />
                  </Link>
                </li>
              </ul>
            </nav>
            <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-6">
              <LanguageSwitcher />
              <span className="text-xs text-black/55">
                {storeConfig.contact.phone}
              </span>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function HeaderIcon({
  href,
  label,
  children,
  className = "",
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`hover:text-wine relative grid size-10 place-items-center transition-colors ${className}`}
    >
      <span className="[&>svg]:size-[1.15rem] [&>svg]:stroke-[1.6]">
        {children}
      </span>
    </Link>
  );
}

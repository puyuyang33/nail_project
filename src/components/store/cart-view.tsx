"use client";

import Image from "next/image";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/utils";
import { useStore } from "./store-provider";

export function CartView() {
  const locale = useLocale() as Locale;
  const t = useTranslations("Cart");
  const common = useTranslations("Common");
  const { cart, hydrated, subtotal, syncStatus, updateQuantity, removeItem } =
    useStore();

  if (!hydrated) {
    return <div className="bg-paper-deep/50 min-h-96 animate-pulse" />;
  }

  if (!cart.length) {
    return (
      <div className="grid min-h-[32rem] place-items-center text-center">
        <div>
          <ShoppingBag
            className="text-wine mx-auto"
            size={32}
            strokeWidth={1.3}
          />
          <h1 className="display mt-6 text-5xl">{t("emptyTitle")}</h1>
          <p className="mt-3 text-black/55">{t("emptyBody")}</p>
          <Link href="/shop" className="button-primary mt-8">
            {common("shopNow")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
      <div>
        <h1 className="display text-6xl">{t("title")}</h1>
        <p className="eyebrow mt-4 text-black/45">
          {t("itemCount", {
            count: cart.reduce((sum, item) => sum + item.quantity, 0),
          })}
        </p>
        {syncStatus === "error" && (
          <p className="text-wine mt-3 text-xs" role="status">
            Saved on this device; account synchronization is temporarily
            unavailable.
          </p>
        )}
        <div className="mt-10 divide-y divide-black/15 border-y border-black/15">
          {cart.map((line) => (
            <article
              key={line.lineId}
              className="grid grid-cols-[6rem_1fr] gap-5 py-6 sm:grid-cols-[8rem_1fr_auto]"
            >
              <Link
                href={`/products/${line.slug}`}
                className="bg-paper-deep relative aspect-[4/5] overflow-hidden"
              >
                <Image
                  src={line.image}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </Link>
              <div>
                <Link
                  href={`/products/${line.slug}`}
                  className="display hover:text-wine text-2xl"
                >
                  {line.name}
                </Link>
                <p className="mt-2 text-xs leading-5 text-black/48">
                  {line.shape} · {line.size} · {line.finish}
                  {line.customSizing ? ` · ${line.customSizing}` : ""}
                </p>
                <p className="mt-3 font-bold sm:hidden">
                  {formatMoney(line.price * line.quantity, locale)}
                </p>
                <div className="mt-4 inline-flex items-center border border-black/20">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(line.lineId, line.quantity - 1)
                    }
                    className="grid size-9 place-items-center"
                    aria-label={`Decrease ${line.name} quantity`}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-xs">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(line.lineId, line.quantity + 1)
                    }
                    className="grid size-9 place-items-center"
                    aria-label={`Increase ${line.name} quantity`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="col-start-2 flex items-end justify-between sm:col-start-auto sm:flex-col sm:items-end">
                <p className="hidden font-bold sm:block">
                  {formatMoney(line.price * line.quantity, locale)}
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(line.lineId)}
                  className="hover:text-wine inline-flex items-center gap-2 text-xs text-black/50 underline-offset-4 hover:underline"
                >
                  <Trash2 size={14} /> {t("remove")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="bg-porcelain h-fit border border-black/15 p-7 lg:sticky lg:top-28">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">{t("subtotal")}</h2>
          <span className="display text-3xl">
            {formatMoney(subtotal, locale)}
          </span>
        </div>
        <p className="mt-3 text-xs text-black/48">{t("shipping")}</p>
        <Link href="/checkout" className="button-primary mt-7 w-full">
          {t("checkout")}
        </Link>
      </aside>
    </div>
  );
}

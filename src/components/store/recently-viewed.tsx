"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Product } from "@/types/catalog";
import { formatMoney, localize } from "@/lib/utils";

const KEY = "lunaria-recent-v1";

export function RecentlyViewed({
  currentId,
  products,
}: {
  currentId: string;
  products: Product[];
}) {
  const locale = useLocale() as Locale;
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let stored: string[] = [];
      try {
        const parsed: unknown = JSON.parse(
          window.localStorage.getItem(KEY) ?? "[]",
        );
        if (Array.isArray(parsed)) {
          stored = parsed.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } catch {
        window.localStorage.removeItem(KEY);
      }
      const next = [
        currentId,
        ...stored.filter((id) => id !== currentId),
      ].slice(0, 5);
      window.localStorage.setItem(KEY, JSON.stringify(next));
      setIds(next);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentId]);

  const recent = useMemo(
    () =>
      ids
        .filter((id) => id !== currentId)
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is Product => Boolean(product))
        .slice(0, 3),
    [currentId, ids, products],
  );

  if (!recent.length) return null;

  return (
    <section className="border-t border-black/10 py-16 md:py-24">
      <div className="container-shell">
        <p className="eyebrow text-wine">Your recent archive</p>
        <h2 className="display mt-4 text-5xl">Recently viewed</h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          {recent.map((product) => (
            <Link
              href={`/products/${product.slug}`}
              key={product.id}
              className="group"
            >
              <div className="bg-paper-deep relative aspect-[4/3] overflow-hidden">
                <Image
                  src={product.images[0].src}
                  alt={localize(product.images[0].alt, locale)}
                  fill
                  sizes="33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-3 flex justify-between">
                <span className="display text-2xl">
                  {localize(product.name, locale)}
                </span>
                <span className="text-sm">
                  {formatMoney(product.price, locale)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { products } from "@/data/demo";
import { formatMoney, localize } from "@/lib/utils";
import { useStore } from "@/components/store/store-provider";

export function WishlistView() {
  const locale = useLocale() as Locale;
  const { wishlist, toggleWishlist, hydrated } = useStore();
  const saved = products.filter((product) => wishlist.includes(product.id));

  if (!hydrated) {
    return <div className="bg-paper-deep/50 min-h-64 animate-pulse" />;
  }

  if (!saved.length) {
    return (
      <div className="border-y border-black/15 py-16 text-center">
        <Heart className="text-wine mx-auto" strokeWidth={1.4} />
        <p className="display mt-5 text-4xl">No saved objects yet.</p>
        <Link href="/shop" className="button-primary mt-7">
          Explore the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {saved.map((product) => (
        <article key={product.id}>
          <Link
            href={`/products/${product.slug}`}
            className="bg-paper-deep relative block aspect-[4/5] overflow-hidden"
          >
            <Image
              src={product.images[0].src}
              alt={localize(product.images[0].alt, locale)}
              fill
              sizes="(min-width: 1024px) 30vw, 50vw"
              className="object-cover transition-transform duration-500 hover:scale-[1.03]"
            />
          </Link>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/products/${product.slug}`}
                className="display hover:text-wine text-2xl"
              >
                {localize(product.name, locale)}
              </Link>
              <p className="mt-1 text-sm">
                {formatMoney(product.price, locale)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className="text-wine grid size-10 place-items-center border border-black/20"
              aria-label={`Remove ${localize(product.name, locale)} from wishlist`}
            >
              <Heart size={17} fill="currentColor" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

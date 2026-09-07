import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Product } from "@/types/catalog";
import { formatMoney, localize } from "@/lib/utils";
import { ProductActions } from "./product-actions";

export async function ProductCard({
  product,
  locale,
  priority = false,
}: {
  product: Product;
  locale: Locale;
  priority?: boolean;
}) {
  const t = await getTranslations("Common");
  const name = localize(product.name, locale);

  return (
    <article className="group">
      <div className="bg-paper-deep relative overflow-hidden">
        <Link href={`/products/${product.slug}`} aria-label={name}>
          <div className="relative aspect-[4/5] overflow-hidden">
            <Image
              src={product.images[0].src}
              alt={localize(product.images[0].alt, locale)}
              fill
              loading={priority ? "eager" : "lazy"}
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </Link>
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {product.newArrival && (
            <span className="bg-acid px-2 py-1 text-[0.6rem] font-bold tracking-wider uppercase">
              {t("new")}
            </span>
          )}
          {product.bestseller && (
            <span className="bg-ink text-paper px-2 py-1 text-[0.6rem] font-bold tracking-wider uppercase">
              {t("bestseller")}
            </span>
          )}
        </div>
        <div className="absolute right-3 bottom-3 translate-y-2 opacity-0 transition-all duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100">
          <ProductActions product={product} localizedName={name} compact />
        </div>
      </div>
      <div className="flex items-start justify-between gap-4 pt-4">
        <div>
          <Link href={`/products/${product.slug}`}>
            <h3 className="display hover:text-wine text-xl font-semibold transition-colors">
              {name}
            </h3>
          </Link>
          <p className="mt-1 text-xs tracking-[0.08em] text-black/50 uppercase">
            {product.tags.slice(0, 2).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 text-sm">
          {product.compareAtPrice && (
            <span className="text-black/40 line-through">
              {formatMoney(product.compareAtPrice, locale)}
            </span>
          )}
          <span className="font-bold">
            {formatMoney(product.price, locale)}
          </span>
        </div>
      </div>
    </article>
  );
}

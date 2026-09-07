import type { Metadata } from "next";
import { Search } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { listCatalogProducts } from "@/data/catalog";
import { ProductCard } from "@/components/store/product-card";
import { localizedAlternates } from "@/lib/seo";

type ShopSearchParams = {
  q?: string;
  category?: string;
  filter?: string;
  sort?: string;
};

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/shop">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("shopTitle"),
    description: t("homeDescription"),
    alternates: localizedAlternates(locale as Locale, "/shop"),
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: PageProps<"/[locale]/shop">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const t = await getTranslations("Shop");
  const values = query as ShopSearchParams;
  const search = values.q?.trim().toLowerCase() ?? "";
  const category = values.category ?? "all";
  const filter = values.filter ?? "";
  const sort = values.sort ?? "featured";
  const products = await listCatalogProducts();

  const filtered = products
    .filter((product) => {
      const haystack = [
        product.name.en,
        product.name.zh,
        product.description.en,
        product.description.zh,
        ...product.tags,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!search || haystack.includes(search)) &&
        (category === "all" || product.category === category) &&
        (!filter ||
          (filter === "featured" && product.featured) ||
          (filter === "new" && product.newArrival) ||
          (filter === "bestseller" && product.bestseller))
      );
    })
    .sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });

  return (
    <>
      <header className="editorial-grid border-b border-black/10 py-16 md:py-24">
        <div className="container-shell">
          <p className="eyebrow text-wine">{t("eyebrow")}</p>
          <h1 className="display mt-5 text-6xl leading-[0.9] font-medium tracking-[-0.05em] md:text-8xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-xl text-black/60">{t("body")}</p>
        </div>
      </header>

      <div className="container-shell py-10 md:py-16">
        <form
          action={`/${safeLocale}/shop`}
          className="grid gap-4 border-b border-black/15 pb-8 md:grid-cols-[1fr_auto_auto]"
        >
          <label className="relative">
            <span className="sr-only">{t("searchLabel")}</span>
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-4 -translate-y-1/2 text-black/40"
              size={18}
            />
            <input
              className="field pl-12"
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t("searchPlaceholder")}
            />
          </label>
          <label>
            <span className="sr-only">{t("filterLabel")}</span>
            <select
              className="field min-w-40"
              name="category"
              defaultValue={category}
            >
              <option value="all">{t("all")}</option>
              <option value="press-ons">{t("pressOns")}</option>
              <option value="supplies">{t("supplies")}</option>
            </select>
          </label>
          <label>
            <span className="sr-only">{t("sortLabel")}</span>
            <select className="field min-w-48" name="sort" defaultValue={sort}>
              <option value="featured">{t("featured")}</option>
              <option value="price-asc">{t("priceLow")}</option>
              <option value="price-desc">{t("priceHigh")}</option>
            </select>
          </label>
          <button type="submit" className="button-primary md:hidden">
            {t("filterLabel")}
          </button>
        </form>

        <div className="mt-7 flex items-center justify-between">
          <p className="eyebrow text-black/45">
            {t("results", { count: filtered.length })}
          </p>
          {(search || category !== "all") && (
            <a
              href={`/${safeLocale}/shop`}
              className="text-xs underline underline-offset-4"
            >
              {t("all")}
            </a>
          )}
        </div>

        {filtered.length ? (
          <div className="mt-9 grid gap-x-5 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={safeLocale}
                priority={index < 4}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center text-center">
            <p className="display text-3xl">{t("noResults")}</p>
          </div>
        )}
      </div>
    </>
  );
}

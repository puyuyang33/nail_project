import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listCatalogCollections, listCatalogProducts } from "@/data/catalog";
import { localize } from "@/lib/utils";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/collections">) {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "系列" : "Collections",
    description:
      locale === "zh"
        ? "探索 Lunaria 限量手工穿戴甲系列。"
        : "Explore limited, hand-finished collections from Lunaria.",
    alternates: localizedAlternates(locale as Locale, "/collections"),
  };
}

export default async function CollectionsPage({
  params,
}: PageProps<"/[locale]/collections">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const [collections, products] = await Promise.all([
    listCatalogCollections(),
    listCatalogProducts(),
  ]);

  return (
    <div className="container-shell py-14 md:py-24">
      <header className="mb-12 grid gap-6 md:grid-cols-2 md:items-end">
        <div>
          <p className="eyebrow text-wine">Curated chapters</p>
          <h1 className="display mt-5 text-7xl leading-none tracking-[-0.05em] md:text-9xl">
            Collections
          </h1>
        </div>
        <p className="max-w-md text-sm leading-7 text-black/60 md:justify-self-end">
          Color stories and material studies, each produced in limited,
          hand-finished editions.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {collections.map((collection, index) => {
          const count = products.filter(
            (product) => product.collection === collection.slug,
          ).length;
          return (
            <Link
              href={`/collections/${collection.slug}`}
              key={collection.slug}
              className={`group relative overflow-hidden ${
                index === 0 ? "md:col-span-2" : ""
              }`}
            >
              <div
                className={`relative ${index === 0 ? "aspect-[16/7]" : "aspect-[4/5]"}`}
              >
                <Image
                  src={collection.image.src}
                  alt={localize(collection.image.alt, safeLocale)}
                  fill
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes={index === 0 ? "90vw" : "45vw"}
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white md:p-9">
                <div>
                  <p className="eyebrow text-white/60">
                    {count} {count === 1 ? "object" : "objects"}
                  </p>
                  <h2 className="display mt-3 text-4xl md:text-6xl">
                    {localize(collection.name, safeLocale)}
                  </h2>
                </div>
                <ArrowUpRight className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

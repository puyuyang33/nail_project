import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { collections as demoCollections } from "@/data/demo";
import { getCatalogCollection, listCatalogProducts } from "@/data/catalog";
import { localize } from "@/lib/utils";
import { ProductCard } from "@/components/store/product-card";
import { localizedAlternates } from "@/lib/seo";

export function generateStaticParams() {
  return demoCollections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/collections/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const collection = await getCatalogCollection(slug);
  if (!collection) return {};
  return {
    title: localize(collection.name, locale as Locale),
    description: localize(collection.description, locale as Locale),
    alternates: localizedAlternates(locale as Locale, `/collections/${slug}`),
  };
}

export default async function CollectionPage({
  params,
}: PageProps<"/[locale]/collections/[slug]">) {
  const { locale, slug } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const [collection, products] = await Promise.all([
    getCatalogCollection(slug),
    listCatalogProducts(),
  ]);
  if (!collection) notFound();
  const items = products.filter((product) => product.collection === slug);

  return (
    <>
      <header className="relative min-h-[32rem] overflow-hidden text-white">
        <Image
          src={collection.image.src}
          alt={localize(collection.image.alt, safeLocale)}
          fill
          loading="eager"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="container-shell relative flex min-h-[32rem] flex-col justify-end py-12">
          <p className="eyebrow text-white/65">Lunaria collection</p>
          <h1 className="display mt-4 text-7xl leading-none tracking-[-0.05em] md:text-9xl">
            {localize(collection.name, safeLocale)}
          </h1>
          <p className="mt-6 max-w-lg text-white/72">
            {localize(collection.description, safeLocale)}
          </p>
        </div>
      </header>
      <div className="container-shell py-14 md:py-20">
        {items.length ? (
          <div className="grid gap-x-5 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={safeLocale}
              />
            ))}
          </div>
        ) : (
          <p className="display py-20 text-center text-3xl">
            This limited chapter has left the atelier.
          </p>
        )}
      </div>
    </>
  );
}

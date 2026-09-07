import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { products as demoProducts } from "@/data/demo";
import { getCatalogProduct, listCatalogProducts } from "@/data/catalog";
import { formatMoney, localize } from "@/lib/utils";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductActions } from "@/components/store/product-actions";
import { ProductCard } from "@/components/store/product-card";
import { storeConfig } from "@/config/store";
import { ReviewForm } from "@/components/store/review-form";
import { RecentlyViewed } from "@/components/store/recently-viewed";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

export function generateStaticParams() {
  return demoProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getCatalogProduct(slug);
  if (!product) return {};
  const safeLocale = locale as Locale;
  return {
    title: localize(product.name, safeLocale),
    description: localize(product.description, safeLocale),
    alternates: {
      canonical: `${storeConfig.url}/${safeLocale}/products/${slug}`,
      languages: {
        en: `${storeConfig.url}/en/products/${slug}`,
        zh: `${storeConfig.url}/zh/products/${slug}`,
      },
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/[locale]/products/[slug]">) {
  const { locale, slug } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const [product, products] = await Promise.all([
    getCatalogProduct(slug),
    listCatalogProducts(),
  ]);
  if (!product) notFound();
  const t = await getTranslations("Product");
  const related = products
    .filter(
      (item) => item.id !== product.id && item.category === product.category,
    )
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localize(product.name, safeLocale),
    description: localize(product.description, safeLocale),
    image: product.images.map((image) => image.src),
    sku: product.id,
    brand: { "@type": "Brand", name: storeConfig.name },
    offers: {
      "@type": "Offer",
      priceCurrency: storeConfig.currency,
      price: product.price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${storeConfig.url}/${safeLocale}/products/${product.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container-shell py-8 md:py-14">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: localize(product.name, safeLocale) },
          ]}
        />
        <div className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
          <ProductGallery images={product.images} locale={safeLocale} />
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow text-wine">{t("madeToOrder")}</p>
            <h1 className="display mt-5 text-6xl leading-[0.86] font-medium tracking-[-0.05em] md:text-8xl">
              {localize(product.name, safeLocale)}
            </h1>
            <div className="mt-6 flex items-center gap-3">
              <span className="text-lg font-bold">
                {formatMoney(product.price, safeLocale)}
              </span>
              {product.compareAtPrice && (
                <span className="text-black/35 line-through">
                  {formatMoney(product.compareAtPrice, safeLocale)}
                </span>
              )}
            </div>
            <p className="mt-7 max-w-lg text-base leading-7 text-black/65">
              {localize(product.description, safeLocale)}
            </p>
            <p className="mt-3 text-xs text-black/45">
              {t("stock", { count: product.stock })}
            </p>
            <div className="mt-8 border-y border-black/15 py-7">
              <ProductActions
                product={product}
                localizedName={localize(product.name, safeLocale)}
              />
            </div>
            <div className="space-y-6 py-7 text-sm leading-7">
              <div>
                <h2 className="eyebrow">{t("details")}</h2>
                <p className="mt-3 text-black/62">
                  {localize(product.story, safeLocale)}
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="text-wine mt-1 shrink-0" size={17} />
                <p className="text-black/62">{t("included")}</p>
              </div>
              <div>
                <h2 className="eyebrow">{t("shipping")}</h2>
                <p className="mt-3 text-black/62">{t("shippingCopy")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="border-t border-black/10 py-16 md:py-24">
        <div className="container-shell grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="eyebrow text-wine">Client notes</p>
            <h2 className="display mt-4 text-5xl">Share your wear.</h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-black/55">
              Reviews are checked by the studio before publishing. Verified
              purchases are marked after matching an order.
            </p>
          </div>
          <ReviewForm productSlug={product.slug} />
        </div>
      </section>

      <section className="bg-porcelain border-t border-black/10 py-16 md:py-24">
        <div className="container-shell">
          <h2 className="display text-5xl">{t("related")}</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} locale={safeLocale} />
            ))}
          </div>
        </div>
      </section>
      <RecentlyViewed currentId={product.id} products={products} />
    </>
  );
}

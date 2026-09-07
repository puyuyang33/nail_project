import Image from "next/image";
import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  listCatalogCollections,
  listCatalogProducts,
  listCatalogServices,
} from "@/data/catalog";
import { localize, formatMoney, minutesToDuration } from "@/lib/utils";
import { ProductCard } from "@/components/store/product-card";
import { storeConfig } from "@/config/store";

const testimonialCopy = {
  en: [
    [
      "The fit felt custom because it actually was. I forgot I was wearing press-ons.",
      "Maya R.",
    ],
    [
      "My set survived a gallery opening, a flight, and an entire week of typing.",
      "Celine W.",
    ],
    ["The quietest, most thoughtful nail appointment I’ve ever had.", "Jo L."],
  ],
  zh: [
    ["尺寸真正为我定制，戴上后几乎忘了这是穿戴甲。", "Maya R."],
    ["我的甲组经历了画廊开幕、飞行和整周打字，依然完好。", "Celine W."],
    ["这是我体验过最安静、最细致的美甲预约。", "Jo L."],
  ],
} as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
    alternates: {
      canonical: `${storeConfig.url}/${locale}`,
      languages: {
        en: `${storeConfig.url}/en`,
        zh: `${storeConfig.url}/zh`,
      },
    },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const t = await getTranslations("Home");
  const common = await getTranslations("Common");
  const [collections, products, services] = await Promise.all([
    listCatalogCollections(),
    listCatalogProducts(),
    listCatalogServices(),
  ]);

  return (
    <>
      <section className="relative min-h-[calc(100svh-6.5rem)] overflow-hidden border-b border-black/10">
        <div className="editorial-grid absolute inset-0 opacity-55" />
        <div className="container-shell relative grid min-h-[calc(100svh-6.5rem)] items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
          <div className="relative z-10 max-w-2xl lg:pr-8">
            <p className="eyebrow reveal text-wine">{t("eyebrow")}</p>
            <h1 className="display reveal reveal-delay-1 mt-6 text-[clamp(4rem,9vw,8.8rem)] leading-[0.76] font-medium tracking-[-0.06em]">
              {t("title")}
            </h1>
            <p className="reveal reveal-delay-2 mt-8 max-w-lg text-base leading-7 text-black/65 md:text-lg">
              {t("subtitle")}
            </p>
            <div className="reveal reveal-delay-3 mt-9 flex flex-wrap gap-3">
              <Link href="/shop" className="button-primary">
                {common("shopNow")} <ArrowUpRight size={16} />
              </Link>
              <Link href="/book" className="button-secondary">
                {common("bookNow")}
              </Link>
            </div>
          </div>

          <div className="reveal reveal-delay-2 relative min-h-[32rem] lg:min-h-[42rem]">
            <div className="bg-paper-deep absolute top-2 right-0 h-[82%] w-[78%] overflow-hidden rounded-t-[11rem] rounded-b-[1.5rem] shadow-[var(--shadow)]">
              <Image
                src={products[0].images[0].src}
                alt={localize(products[0].images[0].alt, safeLocale)}
                fill
                loading="eager"
                sizes="(min-width: 1024px) 48vw, 82vw"
                className="object-cover"
              />
            </div>
            <div className="border-ink bg-acid absolute bottom-0 left-0 w-44 border p-5 sm:w-52">
              <p className="eyebrow">{t("heroNote")}</p>
              <p className="display mt-5 text-3xl leading-none">No. 01</p>
              <ArrowDownRight className="mt-8 ml-auto" size={22} />
            </div>
            <div className="display absolute top-1/2 -right-7 rotate-90 text-xs tracking-[0.34em] uppercase">
              Lunaria / Nail objects
            </div>
          </div>
        </div>
      </section>

      <section className="container-shell py-20 md:py-32">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="eyebrow text-wine">{t("collectionEyebrow")}</p>
            <h2 className="display mt-5 max-w-md text-5xl leading-[0.9] font-medium tracking-[-0.04em] md:text-7xl">
              {t("collectionTitle")}
            </h2>
            <p className="mt-7 max-w-sm text-sm leading-7 text-black/62">
              {t("collectionBody")}
            </p>
            <Link href="/collections" className="button-ghost mt-7">
              {common("viewAll")} <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {collections.map((collection, index) => (
              <Link
                href={`/collections/${collection.slug}`}
                key={collection.slug}
                className={`group relative min-h-[30rem] overflow-hidden ${
                  index === 2 ? "sm:col-span-2 sm:min-h-[25rem]" : ""
                }`}
              >
                <Image
                  src={collection.image.src}
                  alt={localize(collection.image.alt, safeLocale)}
                  fill
                  sizes={index === 2 ? "66vw" : "33vw"}
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-white md:p-8">
                  <div>
                    <p className="eyebrow text-white/60">0{index + 1}</p>
                    <h3 className="display mt-2 text-4xl">
                      {localize(collection.name, safeLocale)}
                    </h3>
                  </div>
                  <ArrowUpRight className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-porcelain border-y border-black/10 py-20 md:py-28">
        <div className="container-shell">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow text-wine">{t("featuredBody")}</p>
              <h2 className="display mt-4 text-5xl font-medium tracking-[-0.04em] md:text-7xl">
                {t("featuredTitle")}
              </h2>
            </div>
            <Link href="/shop?filter=featured" className="button-ghost">
              {common("viewAll")} <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {products
              .filter((product) => product.featured)
              .slice(0, 4)
              .map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={safeLocale}
                  priority={index < 2}
                />
              ))}
          </div>
        </div>
      </section>

      <section className="bg-wine text-paper grid lg:grid-cols-2">
        <div className="relative min-h-[34rem] lg:min-h-[48rem]">
          <Image
            src={services[1].image.src}
            alt={localize(services[1].image.alt, safeLocale)}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex items-center px-6 py-16 sm:px-12 lg:px-[10%]">
          <div className="max-w-xl">
            <p className="eyebrow text-acid">{t("serviceEyebrow")}</p>
            <h2 className="display mt-6 text-6xl leading-[0.9] font-medium tracking-[-0.05em] md:text-8xl">
              {t("serviceTitle")}
            </h2>
            <p className="text-paper/72 mt-8 max-w-md leading-7">
              {t("serviceBody")}
            </p>
            <div className="mt-10 space-y-0 border-t border-white/25">
              {services.map((service) => (
                <Link
                  href={`/services/${service.slug}`}
                  key={service.slug}
                  className="group flex items-center justify-between border-b border-white/25 py-5"
                >
                  <span className="display text-2xl">
                    {localize(service.name, safeLocale)}
                  </span>
                  <span className="text-paper/55 flex items-center gap-4 text-xs">
                    {minutesToDuration(service.durationMinutes, safeLocale)} ·{" "}
                    {formatMoney(service.price, safeLocale)}
                    <ArrowUpRight
                      size={16}
                      className="text-acid transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                    />
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/book"
              className="button-secondary border-paper text-paper hover:text-ink mt-10"
            >
              {common("bookNow")}
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-b border-black/10 py-10">
        <p className="display text-wine text-center text-[clamp(3rem,8vw,8rem)] leading-none whitespace-nowrap italic">
          {t("manifesto")}
        </p>
      </section>

      <section className="container-shell py-20 md:py-28">
        <h2 className="display text-center text-5xl md:text-7xl">
          {t("testimonialsTitle")}
        </h2>
        <div className="mt-12 grid border-y border-black/15 md:grid-cols-3">
          {testimonialCopy[safeLocale].map(([quote, name], index) => (
            <figure
              key={name}
              className={`p-7 md:p-10 ${
                index > 0
                  ? "border-t border-black/15 md:border-t-0 md:border-l"
                  : ""
              }`}
            >
              <blockquote className="display text-2xl leading-tight">
                “{quote}”
              </blockquote>
              <figcaption className="eyebrow mt-8 text-black/45">
                {name} / verified client
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="bg-porcelain border-t border-black/10 py-16 md:py-24">
        <div className="container-shell">
          <div className="flex items-end justify-between gap-6">
            <h2 className="display text-5xl md:text-7xl">{t("socialTitle")}</h2>
            <span className="eyebrow text-wine">@lunaria.atelier</span>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-2 md:grid-cols-4">
            {products.slice(0, 4).map((product, index) => (
              <div
                key={product.id}
                className={`relative overflow-hidden ${
                  index % 2
                    ? "aspect-square md:-translate-y-5"
                    : "aspect-square"
                }`}
              >
                <Image
                  src={product.images[0].src}
                  alt={localize(product.images[0].alt, safeLocale)}
                  fill
                  sizes="25vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

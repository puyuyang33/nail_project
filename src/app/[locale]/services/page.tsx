import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { listCatalogServices } from "@/data/catalog";
import { formatMoney, localize, minutesToDuration } from "@/lib/utils";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("servicesTitle"),
    alternates: localizedAlternates(locale as Locale, "/services"),
  };
}

export default async function ServicesPage({
  params,
}: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const t = await getTranslations("Services");
  const services = await listCatalogServices();

  return (
    <>
      <header className="container-shell grid gap-8 py-16 md:grid-cols-[1fr_0.7fr] md:items-end md:py-24">
        <div>
          <p className="eyebrow text-wine">{t("eyebrow")}</p>
          <h1 className="display mt-5 text-7xl leading-[0.84] tracking-[-0.055em] md:text-9xl">
            {t("title")}
          </h1>
        </div>
        <p className="max-w-lg text-base leading-7 text-black/60">
          {t("body")}
        </p>
      </header>
      <div className="container-shell space-y-6 pb-20 md:pb-28">
        {services.map((service, index) => (
          <article
            key={service.slug}
            className="group bg-porcelain grid overflow-hidden border border-black/15 md:grid-cols-2"
          >
            <div
              className={`relative min-h-80 ${index % 2 ? "md:order-2" : ""}`}
            >
              <Image
                src={service.image.src}
                alt={localize(service.image.alt, safeLocale)}
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex items-center p-7 md:p-12">
              <div>
                <p className="eyebrow text-wine">0{index + 1} / ritual</p>
                <h2 className="display mt-4 text-5xl">
                  {localize(service.name, safeLocale)}
                </h2>
                <p className="mt-5 max-w-md leading-7 text-black/58">
                  {localize(service.description, safeLocale)}
                </p>
                <p className="mt-6 text-sm font-bold">
                  {minutesToDuration(service.durationMinutes, safeLocale)} ·{" "}
                  {formatMoney(service.price, safeLocale)}
                </p>
                <Link
                  href={`/services/${service.slug}`}
                  className="button-secondary mt-8"
                >
                  {t("book")} <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

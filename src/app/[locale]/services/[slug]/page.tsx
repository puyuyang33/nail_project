import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { services as demoServices } from "@/data/demo";
import { getCatalogService } from "@/data/catalog";
import { formatMoney, localize, minutesToDuration } from "@/lib/utils";
import { localizedAlternates } from "@/lib/seo";

export function generateStaticParams() {
  return demoServices.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const service = await getCatalogService(slug);
  if (!service) return {};
  return {
    title: localize(service.name, locale as Locale),
    description: localize(service.description, locale as Locale),
    alternates: localizedAlternates(locale as Locale, `/services/${slug}`),
  };
}

export default async function ServicePage({
  params,
}: PageProps<"/[locale]/services/[slug]">) {
  const { locale, slug } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const service = await getCatalogService(slug);
  if (!service) notFound();

  return (
    <div className="grid min-h-[calc(100svh-6.5rem)] lg:grid-cols-2">
      <div className="relative min-h-[26rem] lg:min-h-full">
        <Image
          src={service.image.src}
          alt={localize(service.image.alt, safeLocale)}
          fill
          loading="eager"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex items-center px-6 py-16 sm:px-12 lg:px-[10%]">
        <div className="max-w-xl">
          <p className="eyebrow text-wine">Private studio ritual</p>
          <h1 className="display mt-5 text-6xl leading-[0.88] tracking-[-0.05em] md:text-8xl">
            {localize(service.name, safeLocale)}
          </h1>
          <p className="mt-7 text-lg leading-8 text-black/62">
            {localize(service.description, safeLocale)}
          </p>
          <div className="mt-8 flex gap-8 border-y border-black/15 py-6 text-sm">
            <div>
              <span className="eyebrow block text-black/40">Time</span>
              <strong className="mt-2 block">
                {minutesToDuration(service.durationMinutes, safeLocale)}
              </strong>
            </div>
            <div>
              <span className="eyebrow block text-black/40">From</span>
              <strong className="mt-2 block">
                {formatMoney(service.price, safeLocale)}
              </strong>
            </div>
          </div>
          <ol className="mt-8 space-y-4 text-sm leading-6 text-black/58">
            <li>01 — Consultation and nail-health check</li>
            <li>02 — Detailed preparation and shaping</li>
            <li>03 — Collaborative color and art direction</li>
            <li>04 — Care notes tailored to your finished set</li>
          </ol>
          <Link
            href={`/book?service=${service.slug}`}
            className="button-primary mt-9"
          >
            Reserve this ritual
          </Link>
        </div>
      </div>
    </div>
  );
}

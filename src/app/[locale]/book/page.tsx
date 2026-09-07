import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { BookingForm } from "@/components/booking/booking-form";
import { listCatalogServices } from "@/data/catalog";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/book">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return {
    title: t("bookingTitle"),
    alternates: localizedAlternates(locale as Locale, "/book"),
  };
}

export default async function BookingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/book">) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const t = await getTranslations("Booking");
  const query = search as { service?: string };
  const services = await listCatalogServices();

  return (
    <div className="container-shell py-14 md:py-24">
      <header className="mb-12 max-w-3xl">
        <p className="eyebrow text-wine">{t("eyebrow")}</p>
        <h1 className="display mt-5 text-7xl leading-[0.88] tracking-[-0.05em] md:text-9xl">
          {t("title")}
        </h1>
        <p className="mt-6 text-black/60">{t("body")}</p>
      </header>
      <BookingForm initialService={query.service} services={services} />
    </div>
  );
}

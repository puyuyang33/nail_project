import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { StoreProvider } from "@/components/store/store-provider";
import { routing } from "@/i18n/routing";
import { storeConfig } from "@/config/store";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });

  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
    openGraph: {
      title: `${storeConfig.name} — ${t("homeTitle")}`,
      description: t("homeDescription"),
      type: "website",
      locale: locale === "zh" ? "zh_CN" : "en_US",
      siteName: storeConfig.name,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": ["Organization", "NailSalon"],
    name: storeConfig.name,
    url: `${storeConfig.url}/${locale}`,
    email: storeConfig.contact.email,
    telephone: storeConfig.contact.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: "1847 W Armitage Ave",
      addressLocality: "Chicago",
      addressRegion: "IL",
      postalCode: "60622",
      addressCountry: "US",
    },
    sameAs: Object.values(storeConfig.social),
  };

  return (
    <NextIntlClientProvider messages={messages}>
      <StoreProvider>
        <div lang={locale} className="flex min-h-screen flex-col">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationJsonLd),
            }}
          />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
      </StoreProvider>
    </NextIntlClientProvider>
  );
}

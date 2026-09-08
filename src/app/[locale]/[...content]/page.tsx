import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { contentPages } from "@/data/content";
import { getPublishedContentPage } from "@/data/content-repository";
import { localize } from "@/lib/utils";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { storeConfig } from "@/config/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[...content]">): Promise<Metadata> {
  const { locale, content } = await params;
  const safeLocale = locale as Locale;
  const key = content.join("/");
  const resolved = await getPublishedContentPage(key);
  if (!resolved) return {};
  const { page } = resolved;
  const path = `/${key}`;
  return {
    title: localize(page.title, safeLocale),
    description: localize(page.intro, safeLocale),
    alternates: {
      canonical: `${storeConfig.url}/${safeLocale}${path}`,
      languages: {
        en: `${storeConfig.url}/en${path}`,
        zh: `${storeConfig.url}/zh${path}`,
      },
    },
  };
}

export function generateStaticParams() {
  return Object.keys(contentPages).map((key) => ({
    content: key.split("/"),
  }));
}

export default async function ContentPage({
  params,
}: PageProps<"/[locale]/[...content]">) {
  const { locale, content } = await params;
  const safeLocale = locale as Locale;
  setRequestLocale(safeLocale);
  const key = content.join("/");
  const resolved = await getPublishedContentPage(key);
  if (!resolved) notFound();
  const { page } = resolved;

  return (
    <div>
      <header className="editorial-grid border-b border-black/10">
        <div className="container-shell grid gap-8 py-16 md:grid-cols-[1fr_0.85fr] md:items-end md:py-24">
          <div>
            <p className="eyebrow text-wine">
              {localize(page.eyebrow, safeLocale)}
            </p>
            <h1 className="display mt-5 text-7xl leading-[0.86] tracking-[-0.055em] md:text-9xl">
              {localize(page.title, safeLocale)}
            </h1>
          </div>
          <p className="max-w-xl text-lg leading-8 text-black/60">
            {localize(page.intro, safeLocale)}
          </p>
        </div>
      </header>

      <div className="container-shell grid gap-12 py-14 md:grid-cols-[0.68fr_1.32fr] md:py-24">
        <aside className="h-fit md:sticky md:top-28">
          <p className="eyebrow text-black/40">Lunaria / information</p>
          <div className="mt-6 text-sm leading-7 text-black/58">
            <p>{storeConfig.contact.address}</p>
            <p>{storeConfig.contact.phone}</p>
            <p>{storeConfig.contact.email}</p>
          </div>
        </aside>
        <div className="space-y-12">
          {page.sections.map((section, index) => (
            <section
              key={localize(section.title, safeLocale)}
              className="border-t border-black/15 pt-7"
            >
              <div className="grid gap-5 sm:grid-cols-[3rem_1fr]">
                <span className="eyebrow text-wine">0{index + 1}</span>
                <div>
                  <h2 className="display text-4xl">
                    {localize(section.title, safeLocale)}
                  </h2>
                  <div className="mt-5 space-y-4 text-[0.95rem] leading-7 text-black/62">
                    {section.body.map((paragraph) => (
                      <p key={paragraph.en}>
                        {localize(paragraph, safeLocale)}
                      </p>
                    ))}
                  </div>
                  {section.list && (
                    <ul className="mt-6 space-y-3">
                      {section.list.map((item) => (
                        <li
                          key={item.en}
                          className="flex gap-3 border-b border-black/10 pb-3 text-sm"
                        >
                          <span className="text-wine">✦</span>
                          {localize(item, safeLocale)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
          {page.form && <InquiryForm type={page.form} />}
        </div>
      </div>
    </div>
  );
}

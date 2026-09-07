import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { storeConfig } from "@/config/store";
import { NewsletterForm } from "./newsletter-form";

const columns = [
  {
    title: "shop",
    links: [
      ["shop", "/shop"],
      ["collections", "/collections"],
      ["wishlist", "/account/wishlist"],
    ],
  },
  {
    title: "care",
    links: [
      ["sizing", "/guides/sizing"],
      ["application", "/guides/application-removal"],
      ["shipping", "/policies/shipping"],
      ["returns", "/policies/returns"],
    ],
  },
  {
    title: "studio",
    links: [
      ["contact", "/contact"],
      ["faq", "/faq"],
      ["wholesale", "/wholesale"],
      ["services", "/services"],
    ],
  },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="bg-ink text-paper">
      <div className="container-shell grid gap-12 py-16 md:grid-cols-[1.35fr_2fr] md:py-24">
        <div>
          <Link href="/" className="display text-4xl font-semibold">
            Lunaria<span className="text-acid">.</span>
          </Link>
          <p className="text-paper/68 mt-5 max-w-sm text-sm leading-6">
            {t("tagline")}
          </p>
          <div className="mt-10 max-w-sm">
            <p className="eyebrow text-acid">Studio dispatch</p>
            <NewsletterForm />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="eyebrow text-paper/45 mb-5">{t(column.title)}</h2>
              <ul className="space-y-3 text-sm">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="hover:text-acid transition-colors"
                    >
                      {t(label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="eyebrow text-paper/45 mb-5">{t("legal")}</h2>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/policies/privacy" className="hover:text-acid">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/policies/terms" className="hover:text-acid">
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-shell text-paper/50 flex flex-col gap-3 py-5 text-[0.65rem] tracking-[0.08em] uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {storeConfig.name}. {t("rights")}
          </span>
          <span>{storeConfig.contact.address}</span>
        </div>
      </div>
    </footer>
  );
}

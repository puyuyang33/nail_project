"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const nextLocale: Locale = locale === "en" ? "zh" : "en";

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.16em] uppercase"
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      aria-label={locale === "en" ? "切换到简体中文" : "Switch to English"}
    >
      <Languages
        aria-hidden="true"
        size={compact ? 18 : 16}
        strokeWidth={1.6}
      />
      {!compact && <span>{locale === "en" ? "中文" : "EN"}</span>}
    </button>
  );
}

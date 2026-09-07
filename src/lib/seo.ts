import type { Locale } from "@/i18n/routing";
import { storeConfig } from "@/config/store";

export function localizedAlternates(locale: Locale, path: string) {
  const normalizedPath = path === "/" ? "" : path;
  return {
    canonical: `${storeConfig.url}/${locale}${normalizedPath}`,
    languages: {
      en: `${storeConfig.url}/en${normalizedPath}`,
      zh: `${storeConfig.url}/zh${normalizedPath}`,
    },
  };
}

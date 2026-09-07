import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/i18n/routing";
import type { LocalizedText } from "@/types/catalog";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function localize(value: LocalizedText, locale: Locale) {
  return value[locale];
}

export function formatMoney(
  amount: number,
  locale: Locale = "en",
  currency = "USD",
) {
  return new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function minutesToDuration(minutes: number, locale: Locale) {
  if (locale === "zh") return `${minutes} 分钟`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ""}`;
}

import type { Locale } from "@/i18n/routing";

export const storeConfig = {
  name: "Lunaria Nail Atelier",
  shortName: "Lunaria",
  description:
    "Made-to-measure press-on nails and thoughtful nail artistry, created in small batches.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  currency: "USD",
  defaultLocale: "en" satisfies Locale,
  locales: ["en", "zh"] satisfies readonly Locale[],
  timezone: "America/Chicago",
  contact: {
    email: "hello@lunarianail.example",
    phone: "+1 (312) 555-0148",
    address: "1847 W Armitage Ave, Chicago, IL 60622",
  },
  social: {
    instagram: "https://instagram.com",
    pinterest: "https://pinterest.com",
    tiktok: "https://tiktok.com",
  },
  businessHours: {
    weekdays: "10:00–19:00",
    saturday: "10:00–17:00",
    sunday: "Closed",
  },
  announcement: {
    en: "Complimentary US shipping on orders $85+",
    zh: "美国境内订单满 $85 免运费",
  },
  booking: {
    leadTimeHours: 12,
    maxAdvanceDays: 60,
    preparationMinutes: 15,
    cancellationHours: 24,
    depositEnabled: false,
    depositAmount: 20,
    smsEnabled: false,
  },
  shippingMethods: [
    { id: "standard", label: "Standard", price: 8, eta: "4–7 business days" },
    { id: "express", label: "Express", price: 18, eta: "2–3 business days" },
    { id: "pickup", label: "Studio pickup", price: 0, eta: "By appointment" },
  ],
  featureFlags: {
    customerAccounts: true,
    reviews: true,
    wholesale: true,
    appointmentDeposits: false,
    smsNotifications: false,
  },
  cloudinaryFolder: "lunaria/products",
} as const;

export type StoreConfig = typeof storeConfig;

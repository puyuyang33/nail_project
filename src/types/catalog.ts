import type { Locale } from "@/i18n/routing";

export type LocalizedText = Record<Locale, string>;

export type ProductImage = {
  src: string;
  alt: LocalizedText;
  width: number;
  height: number;
};

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  story: LocalizedText;
  category: "press-ons" | "supplies";
  collection: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  images: ProductImage[];
  shapes: string[];
  sizes: string[];
  finishes: string[];
  stock: number;
  featured?: boolean;
  newArrival?: boolean;
  bestseller?: boolean;
};

export type Collection = {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  image: ProductImage;
};

export type Service = {
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  price: number;
  durationMinutes: number;
  image: ProductImage;
};

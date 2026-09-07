import "server-only";
import { ProductStatus, ProductType } from "@prisma/client";
import { db } from "@/lib/db";
import { serviceReadiness } from "@/lib/env";
import type {
  Collection,
  Product,
  ProductImage,
  Service,
} from "@/types/catalog";
import {
  collections as demoCollections,
  getCollection as getDemoCollection,
  getProduct as getDemoProduct,
  getService as getDemoService,
  products as demoProducts,
  services as demoServices,
} from "./demo";

const fallbackImage =
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=85";

export async function listCatalogProducts(): Promise<Product[]> {
  if (!serviceReadiness.database) return demoProducts;
  const records = await db.product.findMany({
    where: { status: ProductStatus.ACTIVE },
    include: {
      translations: true,
      images: { orderBy: { position: "asc" } },
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        include: { inventory: true },
      },
      tags: {
        include: {
          tag: { include: { translations: true } },
        },
      },
      collections: { include: { collection: true }, take: 1 },
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
  });

  return records.map((record) => {
    const en = record.translations.find((item) => item.locale === "en");
    const zh = record.translations.find((item) => item.locale === "zh") ?? en;
    const variants = record.variants;
    const images: ProductImage[] = record.images.length
      ? record.images.map((image) => ({
          src: image.url,
          alt: {
            en: image.altText,
            zh: image.altTextZh ?? image.altText,
          },
          width: image.width ?? 1200,
          height: image.height ?? 1500,
        }))
      : [
          {
            src: fallbackImage,
            alt: { en: en?.name ?? record.slug, zh: zh?.name ?? record.slug },
            width: 1200,
            height: 1500,
          },
        ];
    const tagNames = record.tags.map((relation) => {
      const localized =
        relation.tag.translations.find((item) => item.locale === "en") ??
        relation.tag.translations[0];
      return localized?.name ?? relation.tag.slug;
    });
    const prices = variants.map((variant) => Number(variant.price));

    return {
      id: record.id,
      slug: record.slug,
      name: {
        en: en?.name ?? record.slug,
        zh: zh?.name ?? en?.name ?? record.slug,
      },
      description: {
        en: en?.shortDescription ?? en?.description ?? "",
        zh:
          zh?.shortDescription ??
          zh?.description ??
          en?.shortDescription ??
          en?.description ??
          "",
      },
      story: {
        en: en?.description ?? "",
        zh: zh?.description ?? en?.description ?? "",
      },
      category:
        record.type === ProductType.PRESS_ON_SET ? "press-ons" : "supplies",
      collection: record.collections[0]?.collection.slug ?? "studio-essentials",
      tags: tagNames,
      price: prices.length ? Math.min(...prices) : Number(record.basePrice),
      compareAtPrice: record.compareAtPrice
        ? Number(record.compareAtPrice)
        : undefined,
      images,
      shapes: unique(variants.map((variant) => variant.shape)),
      sizes: unique(variants.map((variant) => variant.size)),
      finishes: unique(variants.map((variant) => variant.finish)),
      stock: variants.reduce(
        (sum, variant) =>
          sum +
          Math.max(
            0,
            (variant.inventory?.quantityOnHand ?? 0) -
              (variant.inventory?.quantityReserved ?? 0),
          ),
        0,
      ),
      featured: record.isFeatured,
      newArrival:
        Boolean(record.publishedAt) &&
        record.publishedAt!.getTime() > Date.now() - 45 * 24 * 60 * 60 * 1000,
      bestseller: tagNames.some((tag) => tag.toLowerCase().includes("best")),
    };
  });
}

export async function getCatalogProduct(slug: string) {
  if (!serviceReadiness.database) return getDemoProduct(slug);
  return (await listCatalogProducts()).find((product) => product.slug === slug);
}

export async function listCatalogCollections(): Promise<Collection[]> {
  if (!serviceReadiness.database) return demoCollections;
  const records = await db.collection.findMany({
    where: { isActive: true },
    include: { translations: true },
    orderBy: { position: "asc" },
  });
  return records.map((record) => {
    const en = record.translations.find((item) => item.locale === "en");
    const zh = record.translations.find((item) => item.locale === "zh") ?? en;
    return {
      slug: record.slug,
      name: {
        en: en?.name ?? record.slug,
        zh: zh?.name ?? en?.name ?? record.slug,
      },
      description: {
        en: en?.description ?? "",
        zh: zh?.description ?? en?.description ?? "",
      },
      image: {
        src: record.imageUrl ?? fallbackImage,
        alt: {
          en: `${en?.name ?? record.slug} collection`,
          zh: `${zh?.name ?? en?.name ?? record.slug}系列`,
        },
        width: 1200,
        height: 1500,
      },
    };
  });
}

export async function getCatalogCollection(slug: string) {
  if (!serviceReadiness.database) return getDemoCollection(slug);
  return (await listCatalogCollections()).find(
    (collection) => collection.slug === slug,
  );
}

export async function listCatalogServices(): Promise<Service[]> {
  if (!serviceReadiness.database) return demoServices;
  const records = await db.service.findMany({
    where: { isActive: true, isBookable: true },
    include: { translations: true },
    orderBy: { position: "asc" },
  });
  return records.map((record) => {
    const en = record.translations.find((item) => item.locale === "en");
    const zh = record.translations.find((item) => item.locale === "zh") ?? en;
    return {
      slug: record.slug,
      name: {
        en: en?.name ?? record.slug,
        zh: zh?.name ?? en?.name ?? record.slug,
      },
      description: {
        en: en?.shortDescription ?? en?.description ?? "",
        zh:
          zh?.shortDescription ??
          zh?.description ??
          en?.shortDescription ??
          en?.description ??
          "",
      },
      price: Number(record.basePrice),
      durationMinutes: record.durationMinutes,
      image: {
        src: record.imageUrl ?? fallbackImage,
        alt: {
          en: en?.name ?? record.slug,
          zh: zh?.name ?? en?.name ?? record.slug,
        },
        width: 1200,
        height: 1500,
      },
    };
  });
}

export async function getCatalogService(slug: string) {
  if (!serviceReadiness.database) return getDemoService(slug);
  return (await listCatalogServices()).find((service) => service.slug === slug);
}

function unique(values: Array<string | null>) {
  const present = values.filter((value): value is string => Boolean(value));
  return present.length ? [...new Set(present)] : ["Standard"];
}

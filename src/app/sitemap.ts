import type { MetadataRoute } from "next";
import { storeConfig } from "@/config/store";
import { contentPages } from "@/data/content";
import { routing } from "@/i18n/routing";
import {
  listCatalogCollections,
  listCatalogProducts,
  listCatalogServices,
} from "@/data/catalog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [collections, products, services] = await Promise.all([
    listCatalogCollections(),
    listCatalogProducts(),
    listCatalogServices(),
  ]);
  const staticRoutes = [
    "",
    "/shop",
    "/search",
    "/collections",
    "/supplies",
    "/cart",
    "/services",
    "/book",
    "/orders/track",
    "/login",
    "/register",
    ...Object.keys(contentPages).map((key) => `/${key}`),
  ];
  const dynamicRoutes = [
    ...products.map((product) => `/products/${product.slug}`),
    ...collections.map((collection) => `/collections/${collection.slug}`),
    ...services.map((service) => `/services/${service.slug}`),
  ];
  const now = new Date();

  return routing.locales.flatMap((locale) =>
    [...staticRoutes, ...dynamicRoutes].map((path) => ({
      url: `${storeConfig.url}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path.startsWith("/products/")
        ? ("weekly" as const)
        : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("/products/") ? 0.8 : 0.6,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((alternateLocale) => [
            alternateLocale,
            `${storeConfig.url}/${alternateLocale}${path}`,
          ]),
        ),
      },
    })),
  );
}

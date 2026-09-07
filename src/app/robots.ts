import type { MetadataRoute } from "next";
import { storeConfig } from "@/config/store";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/en/admin/",
        "/zh/admin/",
        "/en/account/",
        "/zh/account/",
        "/en/checkout",
        "/zh/checkout",
      ],
    },
    sitemap: `${storeConfig.url}/sitemap.xml`,
  };
}

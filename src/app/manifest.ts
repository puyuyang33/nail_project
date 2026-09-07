import type { MetadataRoute } from "next";
import { storeConfig } from "@/config/store";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: storeConfig.name,
    short_name: storeConfig.shortName,
    description: storeConfig.description,
    start_url: "/en",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#6b1834",
    icons: [
      {
        src: "/lunaria-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

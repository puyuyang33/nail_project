import { describe, expect, it } from "vitest";
import { collections, products, services } from "./demo";

describe("demo catalog", () => {
  it("uses unique, URL-safe product and collection slugs", () => {
    const slugs = [
      ...products.map((product) => product.slug),
      ...collections.map((collection) => collection.slug),
      ...services.map((service) => service.slug),
    ];
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))).toBe(
      true,
    );
  });

  it("keeps every purchasable product fully configurable and in stock", () => {
    for (const product of products) {
      expect(product.price).toBeGreaterThan(0);
      expect(product.images.length).toBeGreaterThan(0);
      expect(product.shapes.length).toBeGreaterThan(0);
      expect(product.sizes.length).toBeGreaterThan(0);
      expect(product.finishes.length).toBeGreaterThan(0);
      expect(product.stock).toBeGreaterThanOrEqual(0);
    }
  });
});

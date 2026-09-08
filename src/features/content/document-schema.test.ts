import { describe, expect, it } from "vitest";
import { contentKeySchema, contentPageSchema } from "./document-schema";

const validPage = {
  eyebrow: { en: "Story", zh: "故事" },
  title: { en: "Our studio", zh: "我们的工坊" },
  intro: { en: "A considered introduction.", zh: "一段用心的介绍。" },
  sections: [
    {
      title: { en: "Materials", zh: "材料" },
      body: [{ en: "Salon-grade materials.", zh: "沙龙级材料。" }],
    },
  ],
};

describe("content document schema", () => {
  it("accepts versionable bilingual page documents", () => {
    expect(contentPageSchema.parse(validPage)).toEqual(validPage);
  });

  it("rejects incomplete translations", () => {
    expect(
      contentPageSchema.safeParse({
        ...validPage,
        title: { en: "English only" },
      }).success,
    ).toBe(false);
  });

  it("accepts nested content keys and rejects path traversal", () => {
    expect(contentKeySchema.parse("guides/sizing")).toBe("guides/sizing");
    expect(contentKeySchema.safeParse("../secrets").success).toBe(false);
  });
});

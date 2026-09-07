import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

function flatten(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof nested === "object" && nested !== null
      ? flatten(nested as object, path)
      : [path];
  });
}

describe("translation dictionaries", () => {
  it("keeps English and Chinese message keys in parity", () => {
    expect(flatten(zh).sort()).toEqual(flatten(en).sort());
  });

  it("contains translated navigation rather than copied English", () => {
    expect(zh.Nav.shop).not.toBe(en.Nav.shop);
    expect(zh.Nav.book).not.toBe(en.Nav.book);
  });
});

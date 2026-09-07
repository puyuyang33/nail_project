import { describe, expect, it } from "vitest";
import {
  calculateDiscount,
  calculateOrderTotal,
  calculateSubtotal,
} from "./pricing";

describe("commerce pricing", () => {
  it("calculates multi-line subtotals with cent precision", () => {
    expect(
      calculateSubtotal([
        { unitPrice: 52.25, quantity: 2 },
        { unitPrice: 18, quantity: 1 },
      ]),
    ).toBe(122.5);
  });

  it("caps percentage discounts at the subtotal", () => {
    expect(calculateDiscount(100, { type: "percentage", value: 150 })).toBe(
      100,
    );
  });

  it("respects minimum subtotal and totals server-owned values", () => {
    expect(
      calculateOrderTotal({
        lines: [{ unitPrice: 58, quantity: 2 }],
        shipping: 8,
        tax: 10.44,
        discount: { type: "fixed", value: 20, minimumSubtotal: 100 },
      }),
    ).toEqual({
      subtotal: 116,
      discount: 20,
      shipping: 8,
      tax: 10.44,
      total: 114.44,
    });
  });
});

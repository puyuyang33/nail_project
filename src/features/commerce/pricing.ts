import { z } from "zod";

export const moneySchema = z.number().nonnegative().finite();

export type PriceLine = {
  unitPrice: number;
  quantity: number;
};

export type DiscountRule =
  | { type: "percentage"; value: number; minimumSubtotal?: number }
  | { type: "fixed"; value: number; minimumSubtotal?: number };

export function calculateSubtotal(lines: PriceLine[]) {
  return roundMoney(
    lines.reduce((total, line) => {
      moneySchema.parse(line.unitPrice);
      z.number().int().min(1).max(100).parse(line.quantity);
      return total + line.unitPrice * line.quantity;
    }, 0),
  );
}

export function calculateDiscount(
  subtotal: number,
  rule?: DiscountRule | null,
) {
  moneySchema.parse(subtotal);
  if (!rule || subtotal < (rule.minimumSubtotal ?? 0)) return 0;
  moneySchema.parse(rule.value);
  const amount =
    rule.type === "percentage"
      ? subtotal * Math.min(rule.value, 100) * 0.01
      : rule.value;
  return roundMoney(Math.min(subtotal, amount));
}

export function calculateOrderTotal({
  lines,
  shipping,
  tax,
  discount,
}: {
  lines: PriceLine[];
  shipping: number;
  tax: number;
  discount?: DiscountRule | null;
}) {
  const subtotal = calculateSubtotal(lines);
  moneySchema.parse(shipping);
  moneySchema.parse(tax);
  const discountAmount = calculateDiscount(subtotal, discount);
  return {
    subtotal,
    discount: discountAmount,
    shipping: roundMoney(shipping),
    tax: roundMoney(tax),
    total: roundMoney(subtotal - discountAmount + shipping + tax),
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

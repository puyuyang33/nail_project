import { describe, expect, it } from "vitest";
import { appointmentSchema, checkoutSchema, trackingSchema } from "./schemas";

describe("public form validation", () => {
  it("requires at least one appointment contact method", () => {
    const result = appointmentSchema.safeParse({
      locale: "en",
      service: "signature-gel",
      artist: "any",
      date: "2026-10-10",
      time: "10:00",
      name: "Ada Lovelace",
      email: "",
      phone: "",
      contactMethod: "email",
      consent: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects browser-supplied checkout prices by not accepting them", () => {
    const result = checkoutSchema.safeParse({
      locale: "en",
      email: "ada@example.com",
      name: "Ada Lovelace",
      address: {
        line1: "1 Studio Way",
        city: "Chicago",
        region: "IL",
        postalCode: "60622",
        country: "US",
      },
      shippingMethodId: "standard",
      items: [
        {
          productSlug: "lunar-relic",
          quantity: 1,
          shape: "Almond",
          size: "M",
          finish: "Gloss",
          price: 0.01,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("price" in result.data.items[0]).toBe(false);
    }
  });

  it("normalizes and validates public order references", () => {
    expect(
      trackingSchema.parse({
        orderNumber: " lun-24ab9c ",
        contact: "ada@example.com",
      }).orderNumber,
    ).toBe("LUN-24AB9C");
  });
});

import { z } from "zod";

const optionalContact = z.string().trim().max(254).optional().or(z.literal(""));

export const inquirySchema = z.object({
  type: z.enum(["contact", "wholesale"]),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: optionalContact,
  company: z.string().trim().max(150).optional(),
  website: z.url().max(500).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(2000),
});

export const trackingSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^LUN-[A-Z0-9]{6,16}$/),
  contact: z.string().trim().min(5).max(254),
});

export const appointmentSchema = z
  .object({
    locale: z.enum(["en", "zh"]),
    service: z.string().min(1).max(100),
    artist: z.string().min(1).max(100),
    date: z.iso.date(),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    name: z.string().trim().min(2).max(100),
    email: optionalContact,
    phone: optionalContact,
    contactMethod: z.enum(["email", "phone"]),
    notes: z.string().trim().max(1000).optional(),
    consent: z.union([z.literal("on"), z.literal(true)]),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "An email address or phone number is required",
    path: ["email"],
  })
  .refine(
    (value) =>
      value.contactMethod !== "email" ||
      (value.email ? z.email().safeParse(value.email).success : false),
    {
      message: "A valid email is required for email notifications",
      path: ["email"],
    },
  )
  .refine((value) => value.contactMethod !== "phone" || Boolean(value.phone), {
    message: "A phone number is required for phone notifications",
    path: ["phone"],
  });

export const checkoutSchema = z.object({
  locale: z.enum(["en", "zh"]),
  email: z.email(),
  phone: optionalContact,
  name: z.string().trim().min(2).max(100),
  address: z.object({
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().min(2).max(100),
    region: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(3).max(20),
    country: z.string().length(2),
  }),
  shippingMethodId: z.enum(["standard", "express", "pickup"]),
  discountCode: z.string().trim().max(50).optional(),
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1).max(160),
        quantity: z.number().int().min(1).max(10),
        shape: z.string().min(1).max(50),
        size: z.string().min(1).max(50),
        finish: z.string().min(1).max(50),
        customSizing: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(50),
});

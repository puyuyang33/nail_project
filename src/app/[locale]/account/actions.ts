"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

const profileSchema = z.object({
  locale: z.enum(["en", "zh"]),
  name: z.string().trim().min(2).max(100),
  email: z.email().transform(normalizeEmail),
  phone: z.string().trim().max(30).optional(),
});

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Profile details are invalid.");
  const user = await requireUser(parsed.data.locale);
  await requireDatabase().user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      phoneNormalized: parsed.data.phone
        ? normalizePhone(parsed.data.phone)
        : null,
      preferredLocale: parsed.data.locale,
    },
  });
  revalidatePath(`/${parsed.data.locale}/account/profile`);
}

const addressSchema = z.object({
  locale: z.enum(["en", "zh"]),
  label: z.string().trim().min(1).max(80),
  recipientName: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(3).max(20),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
});

export async function addAddress(formData: FormData) {
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Address details are invalid.");
  const user = await requireUser(parsed.data.locale);
  const database = requireDatabase();
  const count = await database.address.count({ where: { userId: user.id } });
  await database.address.create({
    data: {
      userId: user.id,
      label: parsed.data.label,
      recipientName: parsed.data.recipientName,
      line1: parsed.data.line1,
      line2: parsed.data.line2 || null,
      city: parsed.data.city,
      region: parsed.data.region || null,
      postalCode: parsed.data.postalCode,
      countryCode: parsed.data.countryCode,
      isDefaultShipping: count === 0,
      isDefaultBilling: count === 0,
    },
  });
  revalidatePath(`/${parsed.data.locale}/account/addresses`);
}

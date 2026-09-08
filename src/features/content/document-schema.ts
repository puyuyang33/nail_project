import { z } from "zod";

const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(10_000),
  zh: z.string().trim().min(1).max(10_000),
});

const contentSectionSchema = z.object({
  title: localizedTextSchema,
  body: z.array(localizedTextSchema).min(1).max(50),
  list: z.array(localizedTextSchema).max(100).optional(),
});

export const contentPageSchema = z.object({
  eyebrow: localizedTextSchema,
  title: localizedTextSchema,
  intro: localizedTextSchema,
  sections: z.array(contentSectionSchema).min(1).max(100),
  form: z.enum(["contact", "wholesale"]).optional(),
});

export const contentKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/)
  .max(160);

export type ContentPageInput = z.infer<typeof contentPageSchema>;

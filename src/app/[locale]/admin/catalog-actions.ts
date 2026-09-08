"use server";

import { ProductStatus, ProductType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { storeConfig } from "@/config/store";

const supportedLocales = ["en", "zh"] as const satisfies readonly Locale[];
const localeSchema = z.enum(supportedLocales);
const idSchema = z.string().trim().min(1).max(191);
const checkboxSchema = z
  .enum(["on", "true", "1"])
  .optional()
  .transform((value) => value !== undefined);
const moneySchema = z.coerce.number().positive().max(100_000);
const optionalMoneySchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().positive().max(100_000).optional(),
);
const optionalLabelSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().max(80).optional(),
);
const uniqueIdsSchema = z
  .array(idSchema)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Selections must be unique.",
  });

const cloudinaryUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
}, "Image URL must be a secure Cloudinary URL.");

const imageSchema = z
  .object({
    url: cloudinaryUrlSchema,
    publicId: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine(
        (value) => value.startsWith(`${storeConfig.cloudinaryFolder}/`),
        "Image identifier is invalid.",
      ),
    width: z.number().int().positive().max(20_000),
    height: z.number().int().positive().max(20_000),
    altText: z.string().trim().min(2).max(200),
    altTextZh: z.string().trim().min(1).max(200),
    isPrimary: z.boolean(),
  })
  .strict();

const imagesJsonSchema = z
  .string()
  .max(150_000)
  .transform((value, context) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return z.array(imageSchema).max(12).parse(parsed);
    } catch {
      context.addIssue({ code: "custom", message: "Image data is invalid." });
      return z.NEVER;
    }
  });

const productSchema = z
  .object({
    locale: localeSchema,
    slug: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nameEn: z.string().trim().min(2).max(160),
    nameZh: z.string().trim().min(1).max(160),
    descriptionEn: z.string().trim().min(10).max(5000),
    descriptionZh: z.string().trim().min(5).max(5000),
    type: z.enum([
      ProductType.PRESS_ON_SET,
      ProductType.SUPPLY,
      ProductType.ACCESSORY,
    ]),
    price: moneySchema,
    compareAtPrice: optionalMoneySchema,
    sku: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    variantName: z
      .preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z.string().trim().min(2).max(120).optional(),
      )
      .transform((value) => value ?? "Standard"),
    variantPrice: optionalMoneySchema,
    stock: z.coerce.number().int().min(0).max(100_000),
    size: optionalLabelSchema,
    shape: optionalLabelSchema,
    finish: optionalLabelSchema,
    imagesJson: imagesJsonSchema,
    categoryIds: uniqueIdsSchema,
    collectionIds: uniqueIdsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.compareAtPrice !== undefined &&
      value.compareAtPrice < value.price
    ) {
      context.addIssue({
        code: "custom",
        path: ["compareAtPrice"],
        message: "Compare-at price must be at least the base price.",
      });
    }
  });

const productUpdateSchema = z
  .object({
    locale: localeSchema,
    id: idSchema,
    price: moneySchema,
    status: z.nativeEnum(ProductStatus),
    intent: z.enum(["save", "archive"]),
  })
  .strict();

const collectionCreateSchema = z
  .object({
    locale: localeSchema,
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nameEn: z.string().trim().min(2).max(160),
    nameZh: z.string().trim().min(1).max(160),
    descriptionEn: z.string().trim().min(5).max(3000),
    descriptionZh: z.string().trim().min(2).max(3000),
    isActive: checkboxSchema,
    isFeatured: checkboxSchema,
    imagesJson: imagesJsonSchema.refine((images) => images.length > 0, {
      message: "Upload an image for the collection.",
    }),
  })
  .strict();

const collectionUpdateSchema = z
  .object({
    locale: localeSchema,
    id: idSchema,
    isActive: checkboxSchema,
    isFeatured: checkboxSchema,
    intent: z.enum(["save", "deactivate"]),
  })
  .strict();

const serviceFields = {
  locale: localeSchema,
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().trim().min(2).max(160),
  nameZh: z.string().trim().min(1).max(160),
  descriptionEn: z.string().trim().min(10).max(5000),
  descriptionZh: z.string().trim().min(5).max(5000),
  price: moneySchema,
  durationMinutes: z.coerce.number().int().min(5).max(720),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
  depositAmount: optionalMoneySchema,
  isActive: checkboxSchema,
  isBookable: checkboxSchema,
  imagesJson: imagesJsonSchema,
  staffIds: uniqueIdsSchema,
} as const;

const serviceCreateSchema = z
  .object(serviceFields)
  .strict()
  .superRefine(validateServicePayload);

const serviceUpdateSchema = z
  .object({
    ...serviceFields,
    id: idSchema,
    intent: z.enum(["save", "deactivate"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.intent === "save") validateServicePayload(value, context);
  });

const categoryCreateSchema = z
  .object({
    locale: localeSchema,
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    nameEn: z.string().trim().min(2).max(160),
    nameZh: z.string().trim().min(1).max(160),
    descriptionEn: z.string().trim().max(2000),
    descriptionZh: z.string().trim().max(2000),
    isActive: checkboxSchema,
  })
  .strict();

const categoryUpdateSchema = z
  .object({
    locale: localeSchema,
    id: idSchema,
    isActive: checkboxSchema,
    intent: z.enum(["save", "deactivate"]),
  })
  .strict();

type ServicePayload = z.infer<z.ZodObject<typeof serviceFields>>;

function validateServicePayload(
  value: ServicePayload,
  context: z.RefinementCtx,
) {
  if (value.isBookable && !value.isActive) {
    context.addIssue({
      code: "custom",
      path: ["isBookable"],
      message: "A bookable service must also be active.",
    });
  }
  if (value.isBookable && value.staffIds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["staffIds"],
      message: "Assign at least one active staff member to a bookable service.",
    });
  }
  if (value.depositAmount !== undefined && value.depositAmount > value.price) {
    context.addIssue({
      code: "custom",
      path: ["depositAmount"],
      message: "The deposit cannot exceed the service price.",
    });
  }
}

function actionLocale(formData: FormData): Locale {
  const parsed = localeSchema.safeParse(formData.get("locale"));
  if (!parsed.success) throw new Error("Locale is invalid.");
  return parsed.data;
}

function formDataWithArrays(formData: FormData, names: readonly string[]) {
  const values = formDataValues(formData);
  for (const name of names) values[name] = formData.getAll(name);
  return values;
}

function formDataValues(formData: FormData) {
  const values: Record<string, unknown> = Object.fromEntries(
    formData.entries(),
  );
  delete values.primaryImage;
  return values;
}

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback;
}

function primaryImage<T extends z.infer<typeof imageSchema>>(images: T[]) {
  return images.find((image) => image.isPrimary) ?? images[0];
}

function normalizedImages(images: z.infer<typeof imageSchema>[]) {
  const primaryIndex = Math.max(
    0,
    images.findIndex((image) => image.isPrimary),
  );
  return images.map((image, position) => ({
    ...image,
    position,
    isPrimary: position === primaryIndex,
  }));
}

function revalidateLocalized(paths: readonly string[]) {
  for (const locale of supportedLocales) {
    for (const path of paths) {
      revalidatePath(path ? `/${locale}${path}` : `/${locale}`);
    }
  }
}

function revalidateProduct(
  locale: Locale,
  slug: string,
  collectionSlugs: readonly string[],
) {
  revalidatePath(`/${locale}/admin/products`);
  revalidateLocalized([
    "",
    "/shop",
    `/products/${slug}`,
    "/collections",
    ...collectionSlugs.map(
      (collectionSlug) => `/collections/${collectionSlug}`,
    ),
  ]);
}

function revalidateCollection(locale: Locale, slug: string) {
  revalidatePath(`/${locale}/admin/collections`);
  revalidateLocalized(["", "/collections", `/collections/${slug}`]);
}

function revalidateService(locale: Locale, ...slugs: readonly string[]) {
  revalidatePath(`/${locale}/admin/services`);
  revalidateLocalized([
    "",
    "/services",
    "/book",
    ...slugs.map((slug) => `/services/${slug}`),
  ]);
}

function revalidateCategory(locale: Locale) {
  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath(`/${locale}/admin/products`);
  revalidateLocalized(["", "/shop"]);
}

export async function createProduct(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = productSchema.safeParse(
    formDataWithArrays(formData, ["categoryIds", "collectionIds"]),
  );
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Product data is invalid."));
  }

  const database = requireDatabase();
  const result = await database.$transaction(async (tx) => {
    const categories = await tx.category.findMany({
      where: { id: { in: parsed.data.categoryIds } },
      select: { id: true },
    });
    if (categories.length !== parsed.data.categoryIds.length) {
      throw new Error("One or more selected categories no longer exist.");
    }
    const collections = await tx.collection.findMany({
      where: { id: { in: parsed.data.collectionIds } },
      select: { id: true, slug: true },
    });
    if (collections.length !== parsed.data.collectionIds.length) {
      throw new Error("One or more selected collections no longer exist.");
    }

    const variantPrice = parsed.data.variantPrice ?? parsed.data.price;
    const optionValues: Record<string, string> = {};
    if (parsed.data.size) optionValues.size = parsed.data.size;
    if (parsed.data.shape) optionValues.shape = parsed.data.shape;
    if (parsed.data.finish) optionValues.finish = parsed.data.finish;
    if (!Object.keys(optionValues).length) {
      optionValues.variant = parsed.data.variantName;
    }

    const product = await tx.product.create({
      data: {
        slug: parsed.data.slug,
        type: parsed.data.type,
        status: ProductStatus.ACTIVE,
        basePrice: parsed.data.price,
        compareAtPrice: parsed.data.compareAtPrice ?? null,
        isCustomizable: parsed.data.type === ProductType.PRESS_ON_SET,
        publishedAt: new Date(),
        translations: {
          create: [
            {
              locale: "en",
              name: parsed.data.nameEn,
              description: parsed.data.descriptionEn,
              shortDescription: parsed.data.descriptionEn.slice(0, 220),
            },
            {
              locale: "zh",
              name: parsed.data.nameZh,
              description: parsed.data.descriptionZh,
              shortDescription: parsed.data.descriptionZh.slice(0, 220),
            },
          ],
        },
        images: {
          create: normalizedImages(parsed.data.imagesJson).map((image) => ({
            url: image.url,
            publicId: image.publicId,
            width: image.width,
            height: image.height,
            altText: image.altText,
            altTextZh: image.altTextZh,
            position: image.position,
            isPrimary: image.isPrimary,
          })),
        },
        variants: {
          create: {
            sku: parsed.data.sku,
            name: parsed.data.variantName,
            optionValues,
            size: parsed.data.size ?? null,
            shape: parsed.data.shape ?? null,
            finish: parsed.data.finish ?? null,
            price: variantPrice,
            inventory: {
              create: { quantityOnHand: parsed.data.stock },
            },
          },
        },
        categories: {
          create: parsed.data.categoryIds.map((categoryId, position) => ({
            categoryId,
            position,
          })),
        },
        collections: {
          create: parsed.data.collectionIds.map((collectionId, position) => ({
            collectionId,
            position,
          })),
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "product.create",
        entityType: "Product",
        entityId: product.id,
        after: {
          slug: product.slug,
          status: product.status,
          basePrice: parsed.data.price,
          variantPrice,
          sku: parsed.data.sku,
          stock: parsed.data.stock,
          categoryIds: parsed.data.categoryIds,
          collectionIds: parsed.data.collectionIds,
          imageCount: parsed.data.imagesJson.length,
        },
      },
    });

    return {
      slug: product.slug,
      collectionSlugs: collections.map((collection) => collection.slug),
    };
  });

  revalidateProduct(locale, result.slug, result.collectionSlugs);
}

export async function updateProduct(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = productUpdateSchema.safeParse(formDataValues(formData));
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Product update is invalid."));
  }

  const database = requireDatabase();
  const result = await database.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({
      where: { id: parsed.data.id },
      select: {
        slug: true,
        basePrice: true,
        status: true,
        collections: {
          select: { collection: { select: { slug: true } } },
        },
      },
    });
    const status =
      parsed.data.intent === "archive"
        ? ProductStatus.ARCHIVED
        : parsed.data.status;
    const product = await tx.product.update({
      where: { id: parsed.data.id },
      data: {
        status,
        basePrice: parsed.data.price,
        archivedAt: status === ProductStatus.ARCHIVED ? new Date() : null,
        publishedAt:
          status === ProductStatus.ACTIVE &&
          before.status !== ProductStatus.ACTIVE
            ? new Date()
            : undefined,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action:
          parsed.data.intent === "archive"
            ? "product.archive"
            : "product.update",
        entityType: "Product",
        entityId: parsed.data.id,
        before: {
          status: before.status,
          basePrice: Number(before.basePrice),
        },
        after: {
          status: product.status,
          basePrice: parsed.data.price,
        },
      },
    });
    return {
      slug: before.slug,
      collectionSlugs: before.collections.map(
        (relation) => relation.collection.slug,
      ),
    };
  });

  revalidateProduct(locale, result.slug, result.collectionSlugs);
}

export async function createCollection(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = collectionCreateSchema.safeParse(formDataValues(formData));
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Collection data is invalid."));
  }
  const image = primaryImage(parsed.data.imagesJson);
  if (!image) throw new Error("Upload an image for the collection.");

  const database = requireDatabase();
  const collection = await database.$transaction(async (tx) => {
    const last = await tx.collection.aggregate({ _max: { position: true } });
    const created = await tx.collection.create({
      data: {
        slug: parsed.data.slug,
        imageUrl: image.url,
        position: (last._max.position ?? 0) + 10,
        isActive: parsed.data.isActive,
        isFeatured: parsed.data.isActive && parsed.data.isFeatured,
        translations: {
          create: [
            {
              locale: "en",
              name: parsed.data.nameEn,
              description: parsed.data.descriptionEn,
            },
            {
              locale: "zh",
              name: parsed.data.nameZh,
              description: parsed.data.descriptionZh,
            },
          ],
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "collection.create",
        entityType: "Collection",
        entityId: created.id,
        after: {
          slug: created.slug,
          isActive: created.isActive,
          isFeatured: created.isFeatured,
          imageUrl: created.imageUrl,
        },
      },
    });
    return created;
  });

  revalidateCollection(locale, collection.slug);
}

export async function updateCollection(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = collectionUpdateSchema.safeParse(formDataValues(formData));
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Collection update is invalid."));
  }

  const database = requireDatabase();
  const collection = await database.$transaction(async (tx) => {
    const before = await tx.collection.findUniqueOrThrow({
      where: { id: parsed.data.id },
      select: { slug: true, isActive: true, isFeatured: true },
    });
    const isActive =
      parsed.data.intent === "deactivate" ? false : parsed.data.isActive;
    const isFeatured =
      parsed.data.intent === "deactivate"
        ? false
        : isActive && parsed.data.isFeatured;
    const updated = await tx.collection.update({
      where: { id: parsed.data.id },
      data: { isActive, isFeatured },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action:
          parsed.data.intent === "deactivate"
            ? "collection.deactivate"
            : "collection.update",
        entityType: "Collection",
        entityId: parsed.data.id,
        before: {
          isActive: before.isActive,
          isFeatured: before.isFeatured,
        },
        after: {
          isActive: updated.isActive,
          isFeatured: updated.isFeatured,
        },
      },
    });
    return updated;
  });

  revalidateCollection(locale, collection.slug);
}

export async function createService(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = serviceCreateSchema.safeParse(
    formDataWithArrays(formData, ["staffIds"]),
  );
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Service data is invalid."));
  }
  const image = primaryImage(parsed.data.imagesJson);
  if (!image) throw new Error("Upload an image for the service.");

  const database = requireDatabase();
  const service = await database.$transaction(async (tx) => {
    const staff = await tx.staffMember.findMany({
      where: { id: { in: parsed.data.staffIds }, isActive: true },
      select: { id: true },
    });
    if (staff.length !== parsed.data.staffIds.length) {
      throw new Error("One or more selected staff members are not active.");
    }
    const last = await tx.service.aggregate({ _max: { position: true } });
    const created = await tx.service.create({
      data: {
        slug: parsed.data.slug,
        basePrice: parsed.data.price,
        durationMinutes: parsed.data.durationMinutes,
        bufferBeforeMinutes: parsed.data.bufferBeforeMinutes,
        bufferAfterMinutes: parsed.data.bufferAfterMinutes,
        depositAmount: parsed.data.depositAmount ?? null,
        isActive: parsed.data.isActive,
        isBookable: parsed.data.isActive && parsed.data.isBookable,
        imageUrl: image.url,
        position: (last._max.position ?? 0) + 10,
        translations: {
          create: [
            {
              locale: "en",
              name: parsed.data.nameEn,
              description: parsed.data.descriptionEn,
              shortDescription: parsed.data.descriptionEn.slice(0, 220),
            },
            {
              locale: "zh",
              name: parsed.data.nameZh,
              description: parsed.data.descriptionZh,
              shortDescription: parsed.data.descriptionZh.slice(0, 220),
            },
          ],
        },
        staff: {
          create: parsed.data.staffIds.map((staffId) => ({ staffId })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "service.create",
        entityType: "Service",
        entityId: created.id,
        after: {
          slug: created.slug,
          price: parsed.data.price,
          durationMinutes: created.durationMinutes,
          bufferBeforeMinutes: created.bufferBeforeMinutes,
          bufferAfterMinutes: created.bufferAfterMinutes,
          depositAmount: parsed.data.depositAmount ?? null,
          isActive: created.isActive,
          isBookable: created.isBookable,
          staffIds: parsed.data.staffIds,
          imageUrl: created.imageUrl,
        },
      },
    });
    return created;
  });

  revalidateService(locale, service.slug);
}

export async function updateService(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = serviceUpdateSchema.safeParse(
    formDataWithArrays(formData, ["staffIds"]),
  );
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Service update is invalid."));
  }

  const database = requireDatabase();
  const result = await database.$transaction(async (tx) => {
    const before = await tx.service.findUniqueOrThrow({
      where: { id: parsed.data.id },
      include: {
        translations: true,
        staff: { select: { staffId: true } },
      },
    });

    if (parsed.data.intent === "deactivate") {
      const updated = await tx.service.update({
        where: { id: parsed.data.id },
        data: { isActive: false, isBookable: false },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "service.deactivate",
          entityType: "Service",
          entityId: parsed.data.id,
          before: {
            isActive: before.isActive,
            isBookable: before.isBookable,
          },
          after: { isActive: false, isBookable: false },
        },
      });
      return { oldSlug: before.slug, service: updated };
    }

    const staff = await tx.staffMember.findMany({
      where: { id: { in: parsed.data.staffIds }, isActive: true },
      select: { id: true },
    });
    if (staff.length !== parsed.data.staffIds.length) {
      throw new Error("One or more selected staff members are not active.");
    }
    const replacementImage = primaryImage(parsed.data.imagesJson);
    const updated = await tx.service.update({
      where: { id: parsed.data.id },
      data: {
        slug: parsed.data.slug,
        basePrice: parsed.data.price,
        durationMinutes: parsed.data.durationMinutes,
        bufferBeforeMinutes: parsed.data.bufferBeforeMinutes,
        bufferAfterMinutes: parsed.data.bufferAfterMinutes,
        depositAmount: parsed.data.depositAmount ?? null,
        isActive: parsed.data.isActive,
        isBookable: parsed.data.isActive && parsed.data.isBookable,
        imageUrl: replacementImage?.url ?? before.imageUrl,
        translations: {
          upsert: [
            {
              where: {
                serviceId_locale: {
                  serviceId: parsed.data.id,
                  locale: "en",
                },
              },
              update: {
                name: parsed.data.nameEn,
                description: parsed.data.descriptionEn,
                shortDescription: parsed.data.descriptionEn.slice(0, 220),
              },
              create: {
                locale: "en",
                name: parsed.data.nameEn,
                description: parsed.data.descriptionEn,
                shortDescription: parsed.data.descriptionEn.slice(0, 220),
              },
            },
            {
              where: {
                serviceId_locale: {
                  serviceId: parsed.data.id,
                  locale: "zh",
                },
              },
              update: {
                name: parsed.data.nameZh,
                description: parsed.data.descriptionZh,
                shortDescription: parsed.data.descriptionZh.slice(0, 220),
              },
              create: {
                locale: "zh",
                name: parsed.data.nameZh,
                description: parsed.data.descriptionZh,
                shortDescription: parsed.data.descriptionZh.slice(0, 220),
              },
            },
          ],
        },
      },
    });
    await tx.staffService.deleteMany({
      where: { serviceId: parsed.data.id },
    });
    if (parsed.data.staffIds.length) {
      await tx.staffService.createMany({
        data: parsed.data.staffIds.map((staffId) => ({
          serviceId: parsed.data.id,
          staffId,
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "service.update",
        entityType: "Service",
        entityId: parsed.data.id,
        before: {
          slug: before.slug,
          price: Number(before.basePrice),
          durationMinutes: before.durationMinutes,
          bufferBeforeMinutes: before.bufferBeforeMinutes,
          bufferAfterMinutes: before.bufferAfterMinutes,
          depositAmount:
            before.depositAmount === null ? null : Number(before.depositAmount),
          isActive: before.isActive,
          isBookable: before.isBookable,
          staffIds: before.staff.map((relation) => relation.staffId),
          imageUrl: before.imageUrl,
        },
        after: {
          slug: updated.slug,
          price: parsed.data.price,
          durationMinutes: updated.durationMinutes,
          bufferBeforeMinutes: updated.bufferBeforeMinutes,
          bufferAfterMinutes: updated.bufferAfterMinutes,
          depositAmount: parsed.data.depositAmount ?? null,
          isActive: updated.isActive,
          isBookable: updated.isBookable,
          staffIds: parsed.data.staffIds,
          imageUrl: updated.imageUrl,
        },
      },
    });
    return { oldSlug: before.slug, service: updated };
  });

  revalidateService(locale, result.oldSlug, result.service.slug);
}

export async function createCategory(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = categoryCreateSchema.safeParse(formDataValues(formData));
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Category data is invalid."));
  }

  const database = requireDatabase();
  await database.$transaction(async (tx) => {
    const last = await tx.category.aggregate({ _max: { position: true } });
    const category = await tx.category.create({
      data: {
        slug: parsed.data.slug,
        position: (last._max.position ?? 0) + 10,
        isActive: parsed.data.isActive,
        translations: {
          create: [
            {
              locale: "en",
              name: parsed.data.nameEn,
              description: parsed.data.descriptionEn || null,
            },
            {
              locale: "zh",
              name: parsed.data.nameZh,
              description: parsed.data.descriptionZh || null,
            },
          ],
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "category.create",
        entityType: "Category",
        entityId: category.id,
        after: {
          slug: category.slug,
          isActive: category.isActive,
        },
      },
    });
  });

  revalidateCategory(locale);
}

export async function updateCategory(formData: FormData) {
  const locale = actionLocale(formData);
  const actor = await requireAdmin(locale);
  const parsed = categoryUpdateSchema.safeParse(formDataValues(formData));
  if (!parsed.success) {
    throw new Error(firstIssue(parsed.error, "Category update is invalid."));
  }

  const database = requireDatabase();
  await database.$transaction(async (tx) => {
    const before = await tx.category.findUniqueOrThrow({
      where: { id: parsed.data.id },
      select: { isActive: true },
    });
    const isActive =
      parsed.data.intent === "deactivate" ? false : parsed.data.isActive;
    await tx.category.update({
      where: { id: parsed.data.id },
      data: { isActive },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action:
          parsed.data.intent === "deactivate"
            ? "category.deactivate"
            : "category.update",
        entityType: "Category",
        entityId: parsed.data.id,
        before: { isActive: before.isActive },
        after: { isActive },
      },
    });
  });

  revalidateCategory(locale);
}

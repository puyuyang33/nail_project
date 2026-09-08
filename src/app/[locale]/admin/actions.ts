"use server";

import {
  AppointmentStatus,
  OrderStatus,
  ProductStatus,
  ProductType,
  ReviewStatus,
} from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import {
  isAppointmentOverlapError,
  withTransactionRetry,
} from "@/lib/transactions";
import { availabilityBlockingStatuses } from "@/features/appointments/status";

const imageSchema = z.object({
  url: z.url(),
  publicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  altText: z.string().trim().min(2).max(200),
  altTextZh: z.string().trim().min(1).max(200),
  isPrimary: z.boolean(),
});

const productSchema = z.object({
  locale: z.enum(["en", "zh"]),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(160),
  nameEn: z.string().trim().min(2).max(160),
  nameZh: z.string().trim().min(1).max(160),
  descriptionEn: z.string().trim().min(10).max(5000),
  descriptionZh: z.string().trim().min(5).max(5000),
  type: z.enum(["PRESS_ON_SET", "SUPPLY", "ACCESSORY"]),
  price: z.coerce.number().positive().max(10000),
  compareAtPrice: z.coerce
    .number()
    .positive()
    .max(10000)
    .optional()
    .or(z.literal("")),
  sku: z.string().trim().min(3).max(80),
  stock: z.coerce.number().int().min(0).max(100000),
  imagesJson: z.string().transform((value, context) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return z.array(imageSchema).max(12).parse(parsed);
    } catch {
      context.addIssue({ code: "custom", message: "Image data is invalid" });
      return z.NEVER;
    }
  }),
});

export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Product data is invalid.",
    );
  }

  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  await database.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        slug: parsed.data.slug,
        type: ProductType[parsed.data.type],
        status: ProductStatus.ACTIVE,
        basePrice: parsed.data.price,
        compareAtPrice: parsed.data.compareAtPrice || null,
        isCustomizable: parsed.data.type === "PRESS_ON_SET",
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
          create: parsed.data.imagesJson.map((image, position) => ({
            url: image.url,
            publicId: image.publicId,
            width: image.width,
            height: image.height,
            altText: image.altText,
            altTextZh: image.altTextZh,
            position,
            isPrimary: image.isPrimary,
          })),
        },
        variants: {
          create: {
            sku: parsed.data.sku,
            name: "Standard",
            optionValues: { size: "Standard" },
            size: "Standard",
            shape: "Standard",
            finish: "Standard",
            price: parsed.data.price,
            inventory: {
              create: { quantityOnHand: parsed.data.stock },
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "product.create",
        entityType: "Product",
        entityId: product.id,
        after: { slug: product.slug, status: product.status },
      },
    });
  });
  revalidatePath(`/${parsed.data.locale}/admin/products`);
  revalidatePath(`/${parsed.data.locale}/shop`);
}

const productUpdateSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  price: z.coerce.number().positive().max(10000),
  status: z.nativeEnum(ProductStatus),
  intent: z.enum(["save", "archive"]),
});

export async function updateProduct(formData: FormData) {
  const parsed = productUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Product update is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const before = await database.product.findUniqueOrThrow({
    where: { id: parsed.data.id },
    select: { basePrice: true, status: true },
  });
  const status =
    parsed.data.intent === "archive"
      ? ProductStatus.ARCHIVED
      : parsed.data.status;
  await database.$transaction([
    database.product.update({
      where: { id: parsed.data.id },
      data: {
        status,
        basePrice: parsed.data.price,
        archivedAt: status === ProductStatus.ARCHIVED ? new Date() : null,
        publishedAt: status === ProductStatus.ACTIVE ? new Date() : undefined,
      },
    }),
    database.auditLog.create({
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
          price: Number(before.basePrice),
        },
        after: { status, price: parsed.data.price },
      },
    }),
  ]);
  revalidatePath(`/${parsed.data.locale}/admin/products`);
  revalidatePath(`/${parsed.data.locale}/shop`);
}

const orderStatusSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  status: z.nativeEnum(OrderStatus),
});

export async function updateOrderStatus(formData: FormData) {
  const parsed = orderStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Order update is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const before = await database.order.findUniqueOrThrow({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  await database.$transaction([
    database.order.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    }),
    database.auditLog.create({
      data: {
        actorId: actor.id,
        action: "order.status.update",
        entityType: "Order",
        entityId: parsed.data.id,
        before: { status: before.status },
        after: { status: parsed.data.status },
      },
    }),
  ]);
  revalidatePath(`/${parsed.data.locale}/admin/orders`);
}

const appointmentStatusSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  status: z.nativeEnum(AppointmentStatus),
});

export async function updateAppointmentStatus(formData: FormData) {
  const parsed = appointmentStatusSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) throw new Error("Appointment update is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  try {
    await withTransactionRetry(() =>
      database.$transaction(async (tx) => {
        const appointment = await tx.appointment.findUniqueOrThrow({
          where: { id: parsed.data.id },
          include: { _count: { select: { statusHistory: true } } },
        });
        if (
          appointment.status === AppointmentStatus.PENDING &&
          availabilityBlockingStatuses.includes(parsed.data.status)
        ) {
          throw new Error(
            "Accept pending requests from the team calendar so availability and notifications are handled.",
          );
        }
        await tx.appointment.update({
          where: { id: parsed.data.id, version: appointment.version },
          data: {
            status: parsed.data.status,
            version: { increment: 1 },
            canceledAt:
              parsed.data.status === AppointmentStatus.CANCELED
                ? new Date()
                : undefined,
            completedAt:
              parsed.data.status === AppointmentStatus.COMPLETED
                ? new Date()
                : undefined,
          },
        });
        await tx.appointmentStatusHistory.create({
          data: {
            appointmentId: parsed.data.id,
            sequence: appointment._count.statusHistory + 1,
            fromStatus: appointment.status,
            toStatus: parsed.data.status,
            changedById: actor.id,
            note: "Administrator status update",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "appointment.status.update",
            entityType: "Appointment",
            entityId: parsed.data.id,
            before: { status: appointment.status },
            after: { status: parsed.data.status },
          },
        });
      }),
    );
  } catch (error) {
    if (isAppointmentOverlapError(error)) {
      throw new Error("The selected artist is already booked at that time.");
    }
    throw error;
  }
  revalidatePath(`/${parsed.data.locale}/admin/appointments`);
}

const rescheduleSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  localStart: z.string().min(16).max(16),
});

export async function rescheduleAppointment(formData: FormData) {
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Rescheduling details are invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const startAt = fromZonedTime(
    `${parsed.data.localStart}:00`,
    env.BUSINESS_TIMEZONE,
  );
  if (Number.isNaN(startAt.getTime()) || startAt <= new Date()) {
    throw new Error("Choose a future appointment time.");
  }
  await database.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.data.id },
      include: { _count: { select: { statusHistory: true } } },
    });
    const endAt = addMinutes(startAt, appointment.durationMinutes);
    const reservedStartAt = addMinutes(
      startAt,
      -appointment.bufferBeforeMinutes,
    );
    const reservedEndAt = addMinutes(endAt, appointment.bufferAfterMinutes);
    const conflict = appointment.staffId
      ? await tx.appointment.findFirst({
          where: {
            id: { not: appointment.id },
            staffId: appointment.staffId,
            status: {
              in: availabilityBlockingStatuses,
            },
            reservedStartAt: { lt: reservedEndAt },
            reservedEndAt: { gt: reservedStartAt },
          },
          select: { id: true },
        })
      : null;
    if (conflict) throw new Error("The selected artist is already booked.");
    await tx.appointment.update({
      where: { id: appointment.id, version: appointment.version },
      data: {
        startAt,
        endAt,
        reservedStartAt,
        reservedEndAt,
        version: { increment: 1 },
      },
    });
    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        sequence: appointment._count.statusHistory + 1,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        changedById: actor.id,
        note: `Rescheduled from ${appointment.startAt.toISOString()} to ${startAt.toISOString()}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "appointment.reschedule",
        entityType: "Appointment",
        entityId: appointment.id,
        before: { startAt: appointment.startAt.toISOString() },
        after: { startAt: startAt.toISOString() },
      },
    });
  });
  revalidatePath(`/${parsed.data.locale}/admin/appointments`);
}

const reviewStatusSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  status: z.nativeEnum(ReviewStatus),
});

export async function updateReviewStatus(formData: FormData) {
  const parsed = reviewStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Review update is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const review = await database.review.findUniqueOrThrow({
    where: { id: parsed.data.id },
    select: { status: true },
  });
  await database.$transaction([
    database.review.update({
      where: { id: parsed.data.id },
      data: {
        status: parsed.data.status,
        moderatedById: actor.id,
        moderatedAt: new Date(),
      },
    }),
    database.auditLog.create({
      data: {
        actorId: actor.id,
        action: "review.status.update",
        entityType: "Review",
        entityId: parsed.data.id,
        before: { status: review.status },
        after: { status: parsed.data.status },
      },
    }),
  ]);
  revalidatePath(`/${parsed.data.locale}/admin/reviews`);
}

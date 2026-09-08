"use server";

import {
  AppointmentStatus,
  AppointmentTokenPurpose,
  BlockedTimeType,
  ContactMethod,
  DayOfWeek,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import {
  appointmentCanceledEmail,
  appointmentDecisionEmail,
  googleCalendarEventUrl,
  sendEmail,
  workerAppointmentEmail,
} from "@/lib/email";
import { env } from "@/lib/env";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { requireStripe } from "@/lib/stripe";
import { createSecureToken } from "@/lib/tokens";
import {
  isAppointmentOverlapError,
  withTransactionRetry,
} from "@/lib/transactions";
import { storeConfig } from "@/config/store";
import { availabilityBlockingStatuses } from "@/features/appointments/status";

const decisionSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  staffId: z.string().min(1),
});

export async function acceptAppointmentRequest(formData: FormData) {
  const parsed = decisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Appointment decision is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const management = createSecureToken();
  const depositsEnabled =
    env.APPOINTMENT_DEPOSITS_ENABLED || storeConfig.booking.depositEnabled;

  try {
    const appointment = await withTransactionRetry(() =>
      database.$transaction(
        async (tx) => {
          const current = await tx.appointment.findUniqueOrThrow({
            where: { id: parsed.data.id },
            include: {
              service: true,
              _count: { select: { statusHistory: true } },
            },
          });
          if (current.status !== AppointmentStatus.PENDING) {
            throw new Error("Only pending requests can be accepted.");
          }
          if (current.startAt <= new Date()) {
            throw new Error("This requested time has already passed.");
          }
          const worker = await requireBookableWorker(
            tx,
            parsed.data.staffId,
            current.serviceId,
            current.startAt,
            current.reservedStartAt,
            current.reservedEndAt,
            current.id,
          );
          const status = depositsEnabled
            ? AppointmentStatus.PENDING_PAYMENT
            : AppointmentStatus.CONFIRMED;
          const depositAmount = current.service.depositAmount
            ? Number(current.service.depositAmount)
            : storeConfig.booking.depositAmount;
          if (depositsEnabled && depositAmount < 0.5) {
            throw new Error(
              "Configure an appointment deposit of at least 0.50 before accepting.",
            );
          }
          const updated = await tx.appointment.update({
            where: { id: current.id, version: current.version },
            data: {
              staffId: worker.id,
              status,
              holdExpiresAt: depositsEnabled
                ? addMinutes(new Date(), 60)
                : null,
              nextReminderAt: depositsEnabled
                ? null
                : addMinutes(current.startAt, -24 * 60),
              version: { increment: 1 },
              ...(!depositsEnabled
                ? {
                    managementTokens: {
                      create: {
                        tokenHash: management.hash,
                        purpose: AppointmentTokenPurpose.MANAGE,
                        expiresAt: addDays(current.endAt, 7),
                      },
                    },
                  }
                : {}),
            },
            include: { staff: true },
          });
          if (depositsEnabled) {
            await tx.payment.upsert({
              where: {
                idempotencyKey: `appointment:${current.confirmationNumber}:deposit`,
              },
              update: {
                status: PaymentStatus.PENDING,
                amount: depositAmount,
                failureCode: null,
                failureMessage: null,
              },
              create: {
                appointmentId: current.id,
                provider: PaymentProvider.STRIPE,
                status: PaymentStatus.PENDING,
                amount: depositAmount,
                currency: current.currency,
                idempotencyKey: `appointment:${current.confirmationNumber}:deposit`,
              },
            });
          }
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: current.id,
              sequence: current._count.statusHistory + 1,
              fromStatus: current.status,
              toStatus: status,
              changedById: actor.id,
              note: `Accepted and assigned to ${worker.displayName}`,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "appointment.accept",
              entityType: "Appointment",
              entityId: current.id,
              before: { status: current.status, staffId: current.staffId },
              after: { status, staffId: worker.id },
            },
          });
          return {
            ...updated,
            serviceDepositAmount: Number(depositAmount),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    let paymentUrl: string | undefined;
    if (depositsEnabled) {
      try {
        const stripe = requireStripe();
        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            payment_method_types: ["card"],
            customer_email: appointment.emailSnapshot ?? undefined,
            metadata: {
              kind: "appointment",
              appointmentId: appointment.id,
              confirmationNumber: appointment.confirmationNumber,
            },
            payment_intent_data: {
              metadata: {
                kind: "appointment",
                appointmentId: appointment.id,
                confirmationNumber: appointment.confirmationNumber,
              },
            },
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: appointment.currency.toLowerCase(),
                  unit_amount: Math.round(
                    appointment.serviceDepositAmount * 100,
                  ),
                  product_data: {
                    name: `${appointment.serviceNameSnapshot} appointment deposit`,
                  },
                },
              },
            ],
            success_url: `${env.NEXT_PUBLIC_APP_URL}/${appointment.locale}/book/confirmation?reference=${appointment.confirmationNumber}`,
            cancel_url: `${env.NEXT_PUBLIC_APP_URL}/${appointment.locale}/book`,
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
          },
          {
            idempotencyKey: `appointment:${appointment.confirmationNumber}:accept`,
          },
        );
        if (!session.url)
          throw new Error("Stripe did not return a payment URL.");
        paymentUrl = session.url;
        await database.payment.updateMany({
          where: { appointmentId: appointment.id },
          data: {
            providerPaymentId: session.id,
            providerMetadata: { checkoutSessionId: session.id },
          },
        });
      } catch (error) {
        await database.$transaction(async (tx) => {
          const current = await tx.appointment.findUniqueOrThrow({
            where: { id: appointment.id },
            include: { _count: { select: { statusHistory: true } } },
          });
          await tx.appointment.update({
            where: { id: current.id },
            data: {
              status: AppointmentStatus.PENDING,
              holdExpiresAt: null,
              nextReminderAt: null,
              version: { increment: 1 },
            },
          });
          await tx.payment.updateMany({
            where: { appointmentId: current.id },
            data: {
              status: PaymentStatus.FAILED,
              failureMessage:
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : "Stripe session creation failed",
            },
          });
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: current.id,
              sequence: current._count.statusHistory + 1,
              fromStatus: current.status,
              toStatus: AppointmentStatus.PENDING,
              changedById: actor.id,
              note: "Acceptance reverted because deposit checkout failed",
            },
          });
        });
        throw error;
      }
    }

    const notificationWarnings = await notifyAppointmentDecision({
      appointment,
      accepted: true,
      manageToken: depositsEnabled ? undefined : management.token,
      paymentUrl,
    });
    await recordNotificationWarnings(
      database,
      appointment.id,
      notificationWarnings,
    );
    revalidateScheduling(parsed.data.locale);
  } catch (error) {
    if (isAppointmentOverlapError(error)) {
      throw new Error(
        "That worker already has an accepted appointment at this time.",
      );
    }
    throw error;
  }
}

export async function declineAppointmentRequest(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "zh"]),
      id: z.string().min(1),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Appointment decision is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const appointment = await database.$transaction(async (tx) => {
    const current = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.data.id },
      include: {
        staff: true,
        payments: {
          where: { provider: PaymentProvider.STRIPE },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { statusHistory: true } },
      },
    });
    if (
      current.status !== AppointmentStatus.PENDING &&
      current.status !== AppointmentStatus.PENDING_PAYMENT
    ) {
      throw new Error("Only unconfirmed requests can be declined.");
    }
    const updated = await tx.appointment.update({
      where: { id: current.id, version: current.version },
      data: {
        status: AppointmentStatus.CANCELED,
        cancellationReason:
          parsed.data.reason || "Studio could not accept the request",
        canceledAt: new Date(),
        holdExpiresAt: null,
        version: { increment: 1 },
      },
      include: { staff: true },
    });
    await tx.appointmentManagementToken.updateMany({
      where: { appointmentId: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: current.id,
        sequence: current._count.statusHistory + 1,
        fromStatus: current.status,
        toStatus: AppointmentStatus.CANCELED,
        changedById: actor.id,
        note: parsed.data.reason || "Declined by studio",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "appointment.decline",
        entityType: "Appointment",
        entityId: current.id,
        before: { status: current.status },
        after: { status: AppointmentStatus.CANCELED },
      },
    });
    return {
      ...updated,
      paymentSessionId: current.payments[0]?.providerPaymentId ?? null,
    };
  });
  if (appointment.paymentSessionId?.startsWith("cs_")) {
    try {
      await requireStripe().checkout.sessions.expire(
        appointment.paymentSessionId,
      );
    } catch (error) {
      await database.appointment.update({
        where: { id: appointment.id },
        data: {
          internalNotes: `Stripe checkout could not be expired: ${
            error instanceof Error
              ? error.message.slice(0, 300)
              : "Unknown error"
          }`,
        },
      });
    }
  }
  const notificationWarnings = await notifyAppointmentDecision({
    appointment,
    accepted: false,
  });
  await recordNotificationWarnings(
    database,
    appointment.id,
    notificationWarnings,
  );
  revalidateScheduling(parsed.data.locale);
}

const moveSchema = z.object({
  locale: z.enum(["en", "zh"]),
  id: z.string().min(1),
  staffId: z.string().min(1),
  localStart: z.string().min(16).max(16),
});

export async function moveTeamAppointment(formData: FormData) {
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Calendar move is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const startAt = fromZonedTime(
    `${parsed.data.localStart}:00`,
    env.BUSINESS_TIMEZONE,
  );
  if (Number.isNaN(startAt.getTime())) throw new Error("Invalid start time.");

  try {
    const appointment = await withTransactionRetry(() =>
      database.$transaction(
        async (tx) => {
          const current = await tx.appointment.findUniqueOrThrow({
            where: { id: parsed.data.id },
            include: {
              _count: { select: { statusHistory: true } },
            },
          });
          if (
            current.status === AppointmentStatus.CANCELED ||
            current.status === AppointmentStatus.COMPLETED
          ) {
            throw new Error("This appointment can no longer be moved.");
          }
          const endAt = addMinutes(startAt, current.durationMinutes);
          const reservedStartAt = addMinutes(
            startAt,
            -current.bufferBeforeMinutes,
          );
          const reservedEndAt = addMinutes(endAt, current.bufferAfterMinutes);
          const worker = await requireBookableWorker(
            tx,
            parsed.data.staffId,
            current.serviceId,
            startAt,
            reservedStartAt,
            reservedEndAt,
            current.id,
          );
          const updated = await tx.appointment.update({
            where: { id: current.id, version: current.version },
            data: {
              staffId: worker.id,
              startAt,
              endAt,
              reservedStartAt,
              reservedEndAt,
              nextReminderAt:
                current.status === AppointmentStatus.CONFIRMED
                  ? addMinutes(startAt, -24 * 60)
                  : current.nextReminderAt,
              version: { increment: 1 },
            },
            include: { staff: true },
          });
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId: current.id,
              sequence: current._count.statusHistory + 1,
              fromStatus: current.status,
              toStatus: current.status,
              changedById: actor.id,
              note: `Moved from ${current.startAt.toISOString()} to ${startAt.toISOString()} and assigned to ${worker.displayName}`,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "appointment.move",
              entityType: "Appointment",
              entityId: current.id,
              before: {
                staffId: current.staffId,
                startAt: current.startAt.toISOString(),
              },
              after: {
                staffId: worker.id,
                startAt: startAt.toISOString(),
              },
            },
          });
          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    if (appointment.status === AppointmentStatus.CONFIRMED) {
      const notificationWarnings = await notifyAppointmentDecision({
        appointment,
        accepted: true,
      });
      await recordNotificationWarnings(
        database,
        appointment.id,
        notificationWarnings,
      );
    }
    revalidateScheduling(parsed.data.locale);
  } catch (error) {
    if (isAppointmentOverlapError(error)) {
      throw new Error(
        "That worker already has an accepted appointment at this time.",
      );
    }
    throw error;
  }
}

const createAppointmentSchema = z
  .object({
    locale: z.enum(["en", "zh"]),
    customerName: z.string().trim().min(2).max(100),
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(30).optional(),
    serviceId: z.string().min(1),
    staffId: z.string().min(1),
    localStart: z.string().min(16).max(16),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone is required.",
  });

export async function createAdminAppointment(formData: FormData) {
  const parsed = createAppointmentSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Appointment details are invalid.",
    );
  }
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const startAt = fromZonedTime(
    `${parsed.data.localStart}:00`,
    env.BUSINESS_TIMEZONE,
  );
  const service = await database.service.findUniqueOrThrow({
    where: { id: parsed.data.serviceId },
    include: { translations: true },
  });
  if (Number.isNaN(startAt.getTime()) || startAt <= new Date()) {
    throw new Error("Choose a future appointment time.");
  }
  const endAt = addMinutes(startAt, service.durationMinutes);
  const reservedStartAt = addMinutes(startAt, -service.bufferBeforeMinutes);
  const reservedEndAt = addMinutes(endAt, service.bufferAfterMinutes);
  const management = createSecureToken();
  const confirmationNumber = `LUN-A${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;

  try {
    const appointment = await withTransactionRetry(() =>
      database.$transaction(
        async (tx) => {
          const worker = await requireBookableWorker(
            tx,
            parsed.data.staffId,
            service.id,
            startAt,
            reservedStartAt,
            reservedEndAt,
          );
          const created = await tx.appointment.create({
            data: {
              confirmationNumber,
              serviceId: service.id,
              staffId: worker.id,
              createdById: actor.id,
              status: AppointmentStatus.CONFIRMED,
              locale: parsed.data.locale,
              timezone: env.BUSINESS_TIMEZONE,
              customerNameSnapshot: parsed.data.customerName,
              emailSnapshot: parsed.data.email || null,
              emailNormalized: parsed.data.email
                ? normalizeEmail(parsed.data.email)
                : null,
              phoneSnapshot: parsed.data.phone || null,
              phoneNormalized: parsed.data.phone
                ? normalizePhone(parsed.data.phone)
                : null,
              preferredContactMethod: parsed.data.email
                ? ContactMethod.EMAIL
                : ContactMethod.PHONE,
              messagingConsent: true,
              serviceNameSnapshot:
                service.translations.find(
                  (item) => item.locale === parsed.data.locale,
                )?.name ??
                service.translations.find((item) => item.locale === "en")
                  ?.name ??
                service.slug,
              priceSnapshot: service.basePrice,
              depositAmountSnapshot: 0,
              currency: service.currency,
              durationMinutes: service.durationMinutes,
              bufferBeforeMinutes: service.bufferBeforeMinutes,
              bufferAfterMinutes: service.bufferAfterMinutes,
              startAt,
              endAt,
              reservedStartAt,
              reservedEndAt,
              locationSnapshot: {
                name: storeConfig.name,
                address: storeConfig.contact.address,
              },
              customerNotes: parsed.data.notes || null,
              nextReminderAt: addMinutes(startAt, -24 * 60),
              statusHistory: {
                create: {
                  sequence: 1,
                  toStatus: AppointmentStatus.CONFIRMED,
                  changedById: actor.id,
                  note: "Created by administrator",
                },
              },
              ...(parsed.data.email
                ? {
                    managementTokens: {
                      create: {
                        tokenHash: management.hash,
                        purpose: AppointmentTokenPurpose.MANAGE,
                        expiresAt: addDays(endAt, 7),
                      },
                    },
                  }
                : {}),
            },
            include: { staff: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              action: "appointment.create",
              entityType: "Appointment",
              entityId: created.id,
              after: {
                staffId: created.staffId,
                startAt: created.startAt.toISOString(),
              },
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    const notificationWarnings = await notifyAppointmentDecision({
      appointment,
      accepted: true,
      manageToken: parsed.data.email ? management.token : undefined,
    });
    await recordNotificationWarnings(
      database,
      appointment.id,
      notificationWarnings,
    );
    revalidateScheduling(parsed.data.locale);
  } catch (error) {
    if (isAppointmentOverlapError(error)) {
      throw new Error(
        "That worker already has an accepted appointment at this time.",
      );
    }
    throw error;
  }
}

export async function createWorkerTimeOff(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "zh"]),
      staffId: z.string().min(1),
      localStart: z.string().min(16).max(16),
      localEnd: z.string().min(16).max(16),
      reason: z.string().trim().min(2).max(300),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Time-off details are invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const startsAt = fromZonedTime(
    `${parsed.data.localStart}:00`,
    env.BUSINESS_TIMEZONE,
  );
  const endsAt = fromZonedTime(
    `${parsed.data.localEnd}:00`,
    env.BUSINESS_TIMEZONE,
  );
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    throw new Error("Time off must have valid start and end times.");
  }
  const database = requireDatabase();
  await database.$transaction(async (tx) => {
    const worker = await tx.staffMember.findUniqueOrThrow({
      where: { id: parsed.data.staffId },
    });
    const conflictingAppointments = await tx.appointment.count({
      where: {
        staffId: worker.id,
        status: { in: availabilityBlockingStatuses },
        reservedStartAt: { lt: endsAt },
        reservedEndAt: { gt: startsAt },
      },
    });
    if (conflictingAppointments) {
      throw new Error(
        "Reassign or cancel accepted appointments before marking this time off.",
      );
    }
    const blocked = await tx.blockedTime.create({
      data: {
        staffId: worker.id,
        type: BlockedTimeType.PERSONAL,
        startsAt,
        endsAt,
        reason: parsed.data.reason,
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "staff.time_off.create",
        entityType: "BlockedTime",
        entityId: blocked.id,
        after: {
          staffId: worker.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      },
    });
  });
  revalidateScheduling(parsed.data.locale);
}

export async function removeWorkerTimeOff(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "zh"]),
      id: z.string().min(1),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Time-off removal is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const blocked = await database.blockedTime.findUniqueOrThrow({
    where: { id: parsed.data.id },
  });
  await database.$transaction([
    database.blockedTime.delete({ where: { id: blocked.id } }),
    database.auditLog.create({
      data: {
        actorId: actor.id,
        action: "staff.time_off.delete",
        entityType: "BlockedTime",
        entityId: blocked.id,
        before: {
          staffId: blocked.staffId,
          startsAt: blocked.startsAt.toISOString(),
          endsAt: blocked.endsAt.toISOString(),
        },
      },
    }),
  ]);
  revalidateScheduling(parsed.data.locale);
}

export async function setAppointmentOperationalStatus(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "zh"]),
      id: z.string().min(1),
      status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELED"]),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Appointment status is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const nextStatus = AppointmentStatus[parsed.data.status];
  const appointment = await database.$transaction(async (tx) => {
    const current = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.data.id },
      include: {
        staff: true,
        _count: { select: { statusHistory: true } },
      },
    });
    if (
      current.status !== AppointmentStatus.CONFIRMED &&
      current.status !== AppointmentStatus.IN_PROGRESS
    ) {
      throw new Error("Only accepted appointments can be updated here.");
    }
    const updated = await tx.appointment.update({
      where: { id: current.id, version: current.version },
      data: {
        status: nextStatus,
        version: { increment: 1 },
        completedAt:
          nextStatus === AppointmentStatus.COMPLETED ? new Date() : undefined,
        canceledAt:
          nextStatus === AppointmentStatus.CANCELED ? new Date() : undefined,
        cancellationReason:
          nextStatus === AppointmentStatus.CANCELED
            ? parsed.data.reason || "Canceled by studio"
            : undefined,
      },
      include: { staff: true },
    });
    await tx.appointmentStatusHistory.create({
      data: {
        appointmentId: current.id,
        sequence: current._count.statusHistory + 1,
        fromStatus: current.status,
        toStatus: nextStatus,
        changedById: actor.id,
        note:
          parsed.data.reason || `Administrator changed status to ${nextStatus}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "appointment.status.update",
        entityType: "Appointment",
        entityId: current.id,
        before: { status: current.status },
        after: { status: nextStatus },
      },
    });
    return updated;
  });
  if (nextStatus === AppointmentStatus.CANCELED && appointment.emailSnapshot) {
    const delivery = await deliverWithoutBlocking(
      appointment.emailSnapshot,
      appointmentCanceledEmail({
        name: appointment.customerNameSnapshot,
        reference: appointment.confirmationNumber,
        date: formatInTimeZone(
          appointment.startAt,
          appointment.timezone,
          "PPP 'at' p zzz",
        ),
        reason: parsed.data.reason || "Canceled by studio",
      }),
    );
    if (!delivery.delivered) {
      await recordNotificationWarnings(database, appointment.id, [
        delivery.reason,
      ]);
    }
  }
  revalidateScheduling(parsed.data.locale);
}

async function requireBookableWorker(
  tx: Prisma.TransactionClient,
  staffId: string,
  serviceId: string,
  serviceStartAt: Date,
  reservedStartAt: Date,
  reservedEndAt: Date,
  excludeAppointmentId?: string,
) {
  const worker = await tx.staffMember.findFirst({
    where: {
      id: staffId,
      isActive: true,
      services: { some: { serviceId } },
    },
    include: { availability: true },
  });
  if (!worker) {
    throw new Error(
      "The selected worker is inactive or cannot perform this service.",
    );
  }
  const weekday = formatInTimeZone(
    serviceStartAt,
    env.BUSINESS_TIMEZONE,
    "EEEE",
  ).toUpperCase() as DayOfWeek;
  const startMinute =
    Number(formatInTimeZone(reservedStartAt, env.BUSINESS_TIMEZONE, "H")) * 60 +
    Number(formatInTimeZone(reservedStartAt, env.BUSINESS_TIMEZONE, "m"));
  const endMinute =
    Number(formatInTimeZone(reservedEndAt, env.BUSINESS_TIMEZONE, "H")) * 60 +
    Number(formatInTimeZone(reservedEndAt, env.BUSINESS_TIMEZONE, "m"));
  const scheduled = worker.availability.some(
    (rule) =>
      rule.dayOfWeek === weekday &&
      rule.isAvailable &&
      rule.startMinute <= startMinute &&
      rule.endMinute >= endMinute &&
      (!rule.validFrom || rule.validFrom <= reservedStartAt) &&
      (!rule.validUntil || rule.validUntil >= reservedStartAt),
  );
  if (!scheduled) throw new Error("The selected worker is off at this time.");

  const [blocked, conflict, businessHours] = await Promise.all([
    tx.blockedTime.findFirst({
      where: {
        OR: [{ staffId }, { staffId: null }],
        startsAt: { lt: reservedEndAt },
        endsAt: { gt: reservedStartAt },
      },
      select: { id: true },
    }),
    tx.appointment.findFirst({
      where: {
        id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
        staffId,
        status: { in: availabilityBlockingStatuses },
        reservedStartAt: { lt: reservedEndAt },
        reservedEndAt: { gt: reservedStartAt },
      },
      select: { id: true },
    }),
    tx.businessHours.findFirst({
      where: {
        dayOfWeek: weekday,
        isOpen: true,
        startMinute: { lte: startMinute },
        endMinute: { gte: endMinute },
      },
      select: { id: true },
    }),
  ]);
  if (!businessHours) {
    throw new Error("The selected time is outside studio business hours.");
  }
  if (blocked)
    throw new Error("The selected worker is marked off at this time.");
  if (conflict) {
    throw new Error("The selected worker already has an accepted appointment.");
  }
  return worker;
}

async function notifyAppointmentDecision({
  appointment,
  accepted,
  manageToken,
  paymentUrl,
}: {
  appointment: {
    id: string;
    confirmationNumber: string;
    customerNameSnapshot: string;
    emailSnapshot: string | null;
    serviceNameSnapshot: string;
    startAt: Date;
    durationMinutes: number;
    timezone: string;
    locale: string;
    staff: { displayName: string; email: string | null } | null;
  };
  accepted: boolean;
  manageToken?: string;
  paymentUrl?: string;
}) {
  const warnings: string[] = [];
  const date = formatInTimeZone(
    appointment.startAt,
    appointment.timezone,
    "PPP 'at' p zzz",
  );
  const adminUrl = `${env.NEXT_PUBLIC_APP_URL}/${appointment.locale}/admin/calendar?date=${formatInTimeZone(appointment.startAt, appointment.timezone, "yyyy-MM-dd")}`;
  const calendarUrl = googleCalendarEventUrl({
    title: `${appointment.serviceNameSnapshot} · ${appointment.staff?.displayName ?? "Lunaria"}`,
    startsAt: appointment.startAt,
    endsAt: new Date(
      appointment.startAt.getTime() + appointment.durationMinutes * 60_000,
    ),
    details: `Appointment ${appointment.confirmationNumber}`,
    location: storeConfig.contact.address,
  });
  if (appointment.emailSnapshot) {
    const customerDelivery = await deliverWithoutBlocking(
      appointment.emailSnapshot,
      appointmentDecisionEmail({
        name: appointment.customerNameSnapshot,
        reference: appointment.confirmationNumber,
        service: appointment.serviceNameSnapshot,
        date,
        worker: appointment.staff?.displayName ?? "the studio team",
        accepted,
        paymentUrl,
        calendarUrl,
        manageUrl: manageToken
          ? `${env.NEXT_PUBLIC_APP_URL}/${appointment.locale}/appointments/manage/${manageToken}`
          : undefined,
      }),
    );
    if (!customerDelivery.delivered) warnings.push(customerDelivery.reason);
  }
  if (accepted && appointment.staff?.email) {
    const workerDelivery = await deliverWithoutBlocking(
      appointment.staff.email,
      workerAppointmentEmail({
        reference: appointment.confirmationNumber,
        service: appointment.serviceNameSnapshot,
        date,
        customer: appointment.customerNameSnapshot,
        adminUrl,
        calendarUrl,
        tentative: Boolean(paymentUrl),
      }),
    );
    if (!workerDelivery.delivered) warnings.push(workerDelivery.reason);
  }
  return warnings;
}

async function deliverWithoutBlocking(
  to: string | string[],
  message: { subject: string; html: string },
) {
  try {
    return await sendEmail({ to, ...message });
  } catch {
    return {
      delivered: false as const,
      reason: "Notification delivery failed",
    };
  }
}

async function recordNotificationWarnings(
  database: ReturnType<typeof requireDatabase>,
  appointmentId: string,
  warnings: string[],
) {
  if (!warnings.length) return;
  await database.appointment.update({
    where: { id: appointmentId },
    data: {
      internalNotes: `Notification delivery pending: ${warnings.join("; ")}`,
    },
  });
}

function revalidateScheduling(locale: string) {
  revalidatePath(`/${locale}/admin/calendar`);
  revalidatePath(`/${locale}/book`);
  revalidatePath(`/api/availability`);
}

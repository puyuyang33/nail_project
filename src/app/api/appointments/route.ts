import {
  AppointmentStatus,
  AppointmentTokenPurpose,
  ContactMethod,
  DayOfWeek,
  Prisma,
} from "@prisma/client";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { randomBytes } from "node:crypto";
import { appointmentSchema } from "@/features/validation/schemas";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import {
  adminAppointmentRequestEmail,
  appointmentNotificationRecipients,
  appointmentRequestEmail,
  sendEmail,
} from "@/lib/email";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { createSecureToken } from "@/lib/tokens";
import { storeConfig } from "@/config/store";
import { rejectUntrustedOrigin } from "@/lib/request-security";
import {
  isAppointmentOverlapError,
  withTransactionRetry,
} from "@/lib/transactions";
import { availabilityBlockingStatuses } from "@/features/appointments/status";

class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const limit = await enforceRateLimit("booking", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json(
      { error: "Too many booking attempts. Please wait and try again." },
      { status: 429 },
    );
  }
  const parsed = appointmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Review the appointment details and try again.",
      },
      { status: 400 },
    );
  }

  try {
    const database = requireDatabase();
    const service = await database.service.findUnique({
      where: { slug: parsed.data.service },
      include: {
        translations: true,
        staff: { include: { staff: { include: { availability: true } } } },
      },
    });
    if (!service?.isActive || !service.isBookable) {
      throw new BookingError("This service is not currently bookable.");
    }
    const serviceName =
      service.translations.find((item) => item.locale === parsed.data.locale)
        ?.name ??
      service.translations.find((item) => item.locale === "en")?.name ??
      service.slug;
    const startsAt = fromZonedTime(
      `${parsed.data.date}T${parsed.data.time}:00`,
      env.BUSINESS_TIMEZONE,
    );
    if (Number.isNaN(startsAt.getTime())) {
      throw new BookingError("Select a valid date and time.");
    }
    const earliest = addMinutes(
      new Date(),
      storeConfig.booking.leadTimeHours * 60,
    );
    if (startsAt < earliest) {
      throw new BookingError("That time is inside the minimum booking notice.");
    }
    if (startsAt > addDays(new Date(), storeConfig.booking.maxAdvanceDays)) {
      throw new BookingError("That date is outside the booking window.");
    }
    const endAt = addMinutes(startsAt, service.durationMinutes);
    const reservedStartAt = addMinutes(startsAt, -service.bufferBeforeMinutes);
    const reservedEndAt = addMinutes(endAt, service.bufferAfterMinutes);
    const localDay = formatInTimeZone(
      startsAt,
      env.BUSINESS_TIMEZONE,
      "EEEE",
    ).toUpperCase();
    if (!(localDay in DayOfWeek)) {
      throw new BookingError("The selected day is invalid.");
    }
    const minutesFromMidnight =
      Number(parsed.data.time.slice(0, 2)) * 60 +
      Number(parsed.data.time.slice(3, 5));
    const businessHours = await database.businessHours.findFirst({
      where: {
        dayOfWeek: DayOfWeek[localDay as keyof typeof DayOfWeek],
        isOpen: true,
        startMinute: { lte: minutesFromMidnight },
        endMinute: {
          gte:
            minutesFromMidnight +
            service.durationMinutes +
            service.bufferAfterMinutes,
        },
      },
    });
    if (!businessHours) {
      throw new BookingError("That time is outside studio hours.");
    }

    const candidates = service.staff
      .map((relation) => relation.staff)
      .filter(
        (staff) =>
          staff.isActive &&
          (parsed.data.artist === "any" || staff.id === parsed.data.artist) &&
          staff.availability.some(
            (rule) =>
              rule.dayOfWeek ===
                DayOfWeek[localDay as keyof typeof DayOfWeek] &&
              rule.isAvailable &&
              rule.startMinute <=
                minutesFromMidnight - service.bufferBeforeMinutes &&
              rule.endMinute >=
                minutesFromMidnight +
                  service.durationMinutes +
                  service.bufferAfterMinutes &&
              (!rule.validFrom || rule.validFrom <= startsAt) &&
              (!rule.validUntil || rule.validUntil >= startsAt),
          ),
      );
    if (!candidates.length) {
      throw new BookingError("No artist is available for this service.");
    }

    const staff = await firstAvailableStaff(
      database,
      candidates.map((candidate) => candidate.id),
      reservedStartAt,
      reservedEndAt,
    );
    if (!staff) {
      throw new BookingError(
        "That time was just reserved. Please choose another.",
        409,
      );
    }

    const confirmationNumber = `LUN-A${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;
    const management = createSecureToken();
    const depositsEnabled =
      env.APPOINTMENT_DEPOSITS_ENABLED || storeConfig.booking.depositEnabled;
    if (depositsEnabled && !parsed.data.email) {
      throw new BookingError(
        "An email address is required when appointment deposits are enabled.",
      );
    }
    const depositAmount = service.depositAmount
      ? Number(service.depositAmount)
      : storeConfig.booking.depositAmount;
    const status = AppointmentStatus.PENDING;

    const appointment = await withTransactionRetry(() =>
      database.$transaction(
        async (tx) => {
          const conflict = await tx.appointment.findFirst({
            where: {
              staffId: staff.id,
              status: { in: availabilityBlockingStatuses },
              reservedStartAt: { lt: reservedEndAt },
              reservedEndAt: { gt: reservedStartAt },
            },
            select: { id: true },
          });
          if (conflict) {
            throw new BookingError(
              "That time was just reserved. Please choose another.",
              409,
            );
          }
          return tx.appointment.create({
            data: {
              confirmationNumber,
              serviceId: service.id,
              staffId: staff.id,
              status,
              locale: parsed.data.locale,
              timezone: env.BUSINESS_TIMEZONE,
              customerNameSnapshot: parsed.data.name,
              emailSnapshot: parsed.data.email || null,
              emailNormalized: parsed.data.email
                ? normalizeEmail(parsed.data.email)
                : null,
              phoneSnapshot: parsed.data.phone || null,
              phoneNormalized: parsed.data.phone
                ? normalizePhone(parsed.data.phone)
                : null,
              preferredContactMethod:
                parsed.data.contactMethod === "email"
                  ? ContactMethod.EMAIL
                  : ContactMethod.PHONE,
              messagingConsent: true,
              serviceNameSnapshot: serviceName,
              priceSnapshot: service.basePrice,
              depositAmountSnapshot: depositsEnabled ? depositAmount : 0,
              currency: service.currency,
              durationMinutes: service.durationMinutes,
              bufferBeforeMinutes: service.bufferBeforeMinutes,
              bufferAfterMinutes: service.bufferAfterMinutes,
              startAt: startsAt,
              endAt,
              reservedStartAt,
              reservedEndAt,
              locationSnapshot: {
                name: storeConfig.name,
                address: storeConfig.contact.address,
              },
              customerNotes: parsed.data.notes || null,
              holdExpiresAt: null,
              nextReminderAt: null,
              statusHistory: {
                create: {
                  sequence: 1,
                  toStatus: status,
                  note: "Customer appointment request created",
                },
              },
              managementTokens: {
                create: {
                  tokenHash: management.hash,
                  purpose: AppointmentTokenPurpose.MANAGE,
                  expiresAt: addDays(endAt, 7),
                },
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    let emailDelivered = false;
    const warnings: string[] = [];
    const staffMember = candidates.find(
      (candidate) => candidate.id === staff.id,
    );
    const formattedDate = formatInTimeZone(
      startsAt,
      env.BUSINESS_TIMEZONE,
      "PPP 'at' p zzz",
    );
    const manageUrl = `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/appointments/manage/${management.token}`;
    if (parsed.data.email) {
      const content = appointmentRequestEmail({
        name: parsed.data.name,
        reference: confirmationNumber,
        service: serviceName,
        date: formattedDate,
        worker: staffMember?.displayName ?? "the selected artist",
        manageUrl,
      });
      try {
        const delivery = await sendEmail({
          to: parsed.data.email,
          ...content,
        });
        emailDelivered = delivery.delivered;
        if (!delivery.delivered) warnings.push(delivery.reason);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Unknown customer email delivery error",
        );
      }
    }

    const recipients = appointmentNotificationRecipients();
    if (recipients.length) {
      try {
        const delivery = await sendEmail({
          to: recipients,
          ...adminAppointmentRequestEmail({
            reference: confirmationNumber,
            customer: parsed.data.name,
            service: serviceName,
            date: formattedDate,
            worker: staffMember?.displayName ?? "Unassigned",
            contact:
              parsed.data.email || parsed.data.phone || "No contact provided",
            adminUrl: `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/admin/calendar?date=${parsed.data.date}`,
          }),
        });
        if (!delivery.delivered) warnings.push(delivery.reason);
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Unknown administrator email delivery error",
        );
      }
    }

    if (warnings.length) {
      await database.appointment.update({
        where: { id: appointment.id },
        data: {
          internalNotes: `Notification pending: ${warnings.join("; ")}`,
        },
      });
    }

    return Response.json(
      {
        reference: confirmationNumber,
        status,
        emailDelivered,
        awaitingApproval: true,
        ...(warnings.length ? { warning: warnings.join("; ") } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (isAppointmentOverlapError(error)) {
      return Response.json(
        { error: "That time was just reserved. Please choose another." },
        { status: 409 },
      );
    }
    const message =
      error instanceof Error && error.message.includes("not configured")
        ? error.message
        : "Appointment booking is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}

async function firstAvailableStaff(
  database: ReturnType<typeof requireDatabase>,
  staffIds: string[],
  start: Date,
  end: Date,
) {
  for (const id of staffIds) {
    const [appointment, block] = await Promise.all([
      database.appointment.findFirst({
        where: {
          staffId: id,
          status: { in: availabilityBlockingStatuses },
          reservedStartAt: { lt: end },
          reservedEndAt: { gt: start },
        },
        select: { id: true },
      }),
      database.blockedTime.findFirst({
        where: {
          OR: [{ staffId: id }, { staffId: null }],
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        select: { id: true },
      }),
    ]);
    if (!appointment && !block) return { id };
  }
  return null;
}

import {
  AppointmentStatus,
  AppointmentTokenPurpose,
  ContactMethod,
  DayOfWeek,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { addDays, addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { randomBytes } from "node:crypto";
import { appointmentSchema } from "@/features/validation/schemas";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { appointmentConfirmationEmail, sendEmail } from "@/lib/email";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { createSecureToken } from "@/lib/tokens";
import { storeConfig } from "@/config/store";
import { requireStripe } from "@/lib/stripe";
import { rejectUntrustedOrigin } from "@/lib/request-security";
import {
  isAppointmentOverlapError,
  withTransactionRetry,
} from "@/lib/transactions";

const activeStatuses: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

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
          (parsed.data.artist === "any" ||
            slugify(staff.displayName) === parsed.data.artist) &&
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
    const depositAmount = service.depositAmount
      ? Number(service.depositAmount)
      : storeConfig.booking.depositAmount;
    const status = depositsEnabled
      ? AppointmentStatus.PENDING_PAYMENT
      : AppointmentStatus.CONFIRMED;

    const appointment = await withTransactionRetry(() =>
      database.$transaction(
        async (tx) => {
          const conflict = await tx.appointment.findFirst({
            where: {
              staffId: staff.id,
              status: { in: activeStatuses },
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
              holdExpiresAt: depositsEnabled
                ? addMinutes(new Date(), 60)
                : null,
              nextReminderAt: addMinutes(startsAt, -24 * 60),
              statusHistory: {
                create: {
                  sequence: 1,
                  toStatus: status,
                  note: "Created through guest booking",
                },
              },
              ...(depositsEnabled
                ? {
                    payments: {
                      create: {
                        provider: PaymentProvider.STRIPE,
                        status: PaymentStatus.PENDING,
                        amount: depositAmount,
                        currency: service.currency,
                        idempotencyKey: `appointment:${confirmationNumber}`,
                      },
                    },
                  }
                : {
                    managementTokens: {
                      create: {
                        tokenHash: management.hash,
                        purpose: AppointmentTokenPurpose.MANAGE,
                        expiresAt: addDays(endAt, 7),
                      },
                    },
                  }),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    if (depositsEnabled) {
      const stripe = requireStripe();
      try {
        const session = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            payment_method_types: ["card"],
            customer_email: parsed.data.email || undefined,
            metadata: {
              kind: "appointment",
              appointmentId: appointment.id,
              confirmationNumber,
            },
            payment_intent_data: {
              metadata: {
                kind: "appointment",
                appointmentId: appointment.id,
                confirmationNumber,
              },
            },
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: service.currency.toLowerCase(),
                  unit_amount: Math.round(depositAmount * 100),
                  product_data: {
                    name: `${serviceName} appointment deposit`,
                  },
                },
              },
            ],
            success_url: `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/book/confirmation?reference=${confirmationNumber}`,
            cancel_url: `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/book?service=${service.slug}`,
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
          },
          { idempotencyKey: `appointment:${confirmationNumber}` },
        );
        await database.payment.updateMany({
          where: { appointmentId: appointment.id },
          data: {
            providerPaymentId: session.id,
            providerMetadata: { checkoutSessionId: session.id },
          },
        });
        if (!session.url) {
          throw new BookingError("Stripe did not return a checkout URL.", 502);
        }
        return Response.json(
          { reference: confirmationNumber, status, checkoutUrl: session.url },
          { status: 201 },
        );
      } catch (error) {
        await database.$transaction([
          database.appointment.update({
            where: { id: appointment.id },
            data: {
              status: AppointmentStatus.EXPIRED,
              holdExpiresAt: new Date(),
            },
          }),
          database.payment.updateMany({
            where: { appointmentId: appointment.id },
            data: { status: PaymentStatus.FAILED },
          }),
        ]);
        throw error;
      }
    }

    let emailDelivered = false;
    let emailWarning: string | undefined;
    if (parsed.data.email) {
      const manageUrl = `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/appointments/manage/${management.token}`;
      const content = appointmentConfirmationEmail({
        name: parsed.data.name,
        reference: confirmationNumber,
        service: serviceName,
        date: formatInTimeZone(
          startsAt,
          env.BUSINESS_TIMEZONE,
          "PPP 'at' p zzz",
        ),
        manageUrl,
      });
      try {
        const delivery = await sendEmail({
          to: parsed.data.email,
          ...content,
        });
        emailDelivered = delivery.delivered;
        emailWarning = delivery.delivered ? undefined : delivery.reason;
      } catch (error) {
        emailWarning =
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Unknown email delivery error";
      }
      if (!emailDelivered) {
        await database.appointment.update({
          where: { id: appointment.id },
          data: {
            internalNotes: `Confirmation email pending: ${emailWarning}`,
          },
        });
      }
    }

    return Response.json(
      {
        reference: confirmationNumber,
        status,
        emailDelivered,
        ...(emailWarning ? { warning: emailWarning } : {}),
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
          status: { in: activeStatuses },
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

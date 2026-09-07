import {
  AppointmentStatus,
  AppointmentTokenPurpose,
  Prisma,
} from "@prisma/client";
import { differenceInHours } from "date-fns";
import { requireDatabase } from "@/lib/db";
import { serviceReadiness } from "@/lib/env";
import { hashToken } from "@/lib/tokens";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { storeConfig } from "@/config/store";
import { rejectUntrustedOrigin } from "@/lib/request-security";

const cancellable = new Set<AppointmentStatus>([
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.CONFIRMED,
]);

export async function GET(
  _request: Request,
  context: RouteContext<"/api/appointments/manage/[token]">,
) {
  if (!serviceReadiness.database) {
    return Response.json(
      { error: "Appointment management requires a configured database." },
      { status: 503 },
    );
  }
  const { token } = await context.params;
  const record = await findToken(token);
  if (!record) {
    return Response.json(
      { error: "This link is invalid or expired." },
      { status: 404 },
    );
  }
  return Response.json({
    confirmationNumber: record.appointment.confirmationNumber,
    service: record.appointment.serviceNameSnapshot,
    startsAt: record.appointment.startAt,
    timezone: record.appointment.timezone,
    status: record.appointment.status,
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/appointments/manage/[token]">,
) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (!serviceReadiness.database) {
    return Response.json(
      { error: "Appointment management requires a configured database." },
      { status: 503 },
    );
  }
  const limit = await enforceRateLimit("booking", getClientIdentifier(request));
  if (!limit.success) {
    return Response.json({ error: "Too many attempts." }, { status: 429 });
  }
  const { token } = await context.params;
  const record = await findToken(token);
  if (!record || !cancellable.has(record.appointment.status)) {
    return Response.json(
      { error: "This appointment cannot be changed with this link." },
      { status: 404 },
    );
  }
  if (
    differenceInHours(record.appointment.startAt, new Date()) <
    storeConfig.booking.cancellationHours
  ) {
    return Response.json(
      { error: "Online cancellation closes 24 hours before the appointment." },
      { status: 409 },
    );
  }
  const database = requireDatabase();
  await database.$transaction(
    async (tx) => {
      const sequence = await tx.appointmentStatusHistory.count({
        where: { appointmentId: record.appointmentId },
      });
      await tx.appointment.update({
        where: {
          id: record.appointmentId,
          version: record.appointment.version,
        },
        data: {
          status: AppointmentStatus.CANCELED,
          canceledAt: new Date(),
          cancellationReason: "Cancelled through guest management link",
          version: { increment: 1 },
        },
      });
      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: record.appointmentId,
          sequence: sequence + 1,
          fromStatus: record.appointment.status,
          toStatus: AppointmentStatus.CANCELED,
          note: "Guest cancellation",
        },
      });
      await tx.appointmentManagementToken.updateMany({
        where: { appointmentId: record.appointmentId, revokedAt: null },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return Response.json({ status: "cancelled" });
}

async function findToken(token: string) {
  if (token.length < 32 || token.length > 200) return null;
  return requireDatabase().appointmentManagementToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      purpose: AppointmentTokenPurpose.MANAGE,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { appointment: true },
  });
}

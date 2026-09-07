import {
  AppointmentStatus,
  InventoryAdjustmentType,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { addMinutes, subMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { appointmentReminderEmail, sendEmail } from "@/lib/email";

export async function GET(request: Request) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const database = requireDatabase();
  const staleOrders = await database.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      createdAt: { lt: subMinutes(new Date(), 240) },
    },
    include: { items: true, discountRedemption: true },
    take: 50,
  });
  let releasedOrders = 0;
  for (const order of staleOrders) {
    await database.$transaction(
      async (tx) => {
        const current = await tx.order.findUniqueOrThrow({
          where: { id: order.id },
          select: { status: true, paymentStatus: true },
        });
        if (
          current.status !== OrderStatus.PENDING_PAYMENT ||
          current.paymentStatus !== PaymentStatus.PENDING
        ) {
          return;
        }
        for (const item of order.items) {
          if (!item.variantId) continue;
          const inventory = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
          });
          if (!inventory) continue;
          const released = Math.min(item.quantity, inventory.quantityReserved);
          if (!released) continue;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantityReserved: { decrement: released },
              version: { increment: 1 },
            },
          });
          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: inventory.id,
              type: InventoryAdjustmentType.RELEASE,
              quantityDelta: -released,
              reason: `Expired checkout recovery ${order.orderNumber}`,
              referenceType: "order",
              referenceId: order.id,
            },
          });
        }
        if (order.discountId && order.discountRedemption) {
          await tx.discountRedemption.delete({ where: { orderId: order.id } });
          await tx.discount.updateMany({
            where: { id: order.discountId, usageCount: { gt: 0 } },
            data: { usageCount: { decrement: 1 } },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELED,
            paymentStatus: PaymentStatus.CANCELED,
            canceledAt: new Date(),
          },
        });
        await tx.payment.updateMany({
          where: { orderId: order.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.CANCELED },
        });
        releasedOrders += 1;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  const expiredHolds = await database.$transaction(async (tx) => {
    const expired = await tx.appointment.findMany({
      where: {
        status: AppointmentStatus.PENDING_PAYMENT,
        holdExpiresAt: { lte: new Date() },
      },
      select: { id: true },
    });
    if (!expired.length) return 0;
    const ids = expired.map((appointment) => appointment.id);
    await tx.appointment.updateMany({
      where: { id: { in: ids } },
      data: { status: AppointmentStatus.EXPIRED },
    });
    await tx.payment.updateMany({
      where: { appointmentId: { in: ids }, status: "PENDING" },
      data: { status: "CANCELED" },
    });
    return ids.length;
  });
  const due = await database.appointment.findMany({
    where: {
      status: AppointmentStatus.CONFIRMED,
      emailNormalized: { not: null },
      reminderSentAt: null,
      reminderAttempts: { lt: 3 },
      nextReminderAt: { lte: new Date() },
      startAt: { gt: new Date() },
    },
    include: {
      managementTokens: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        take: 1,
      },
    },
    orderBy: { nextReminderAt: "asc" },
    take: 50,
  });
  let delivered = 0;
  const failures: string[] = [];

  for (const appointment of due) {
    if (!appointment.emailSnapshot) continue;
    try {
      const managePath = appointment.managementTokens[0]
        ? `/${appointment.locale}/account/appointments`
        : `/${appointment.locale}/contact`;
      const result = await sendEmail({
        to: appointment.emailSnapshot,
        ...appointmentReminderEmail({
          name: appointment.customerNameSnapshot,
          reference: appointment.confirmationNumber,
          service: appointment.serviceNameSnapshot,
          date: formatInTimeZone(
            appointment.startAt,
            appointment.timezone,
            "PPP 'at' p zzz",
          ),
          manageUrl: `${env.NEXT_PUBLIC_APP_URL}${managePath}`,
        }),
      });
      if (!result.delivered) throw new Error(result.reason);
      await database.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: new Date(), nextReminderAt: null },
      });
      delivered += 1;
    } catch (error) {
      failures.push(appointment.confirmationNumber);
      await database.appointment.update({
        where: { id: appointment.id },
        data: {
          reminderAttempts: { increment: 1 },
          nextReminderAt: addMinutes(new Date(), 30),
          internalNotes: `Reminder delivery failed: ${
            error instanceof Error
              ? error.message.slice(0, 300)
              : "Unknown error"
          }`,
        },
      });
    }
  }

  return Response.json({
    processed: due.length,
    delivered,
    failed: failures.length,
    failedReferences: failures,
    expiredHolds,
    releasedOrders,
  });
}

import {
  AppointmentStatus,
  AppointmentTokenPurpose,
  InventoryAdjustmentType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  WebhookStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import {
  appointmentConfirmationEmail,
  orderConfirmationEmail,
  sendEmail,
} from "@/lib/email";
import { requireStripe } from "@/lib/stripe";
import { createSecureToken } from "@/lib/tokens";
import { withTransactionRetry } from "@/lib/transactions";

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }
  const payload = await request.text();
  const stripe = requireStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return Response.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  const database = requireDatabase();
  const claim = await claimWebhook(event, payload);
  if (claim === "processed") {
    return Response.json({ received: true, duplicate: true });
  }
  if (claim === "busy") {
    return Response.json(
      { error: "This event is already being processed. Retry later." },
      { status: 409 },
    );
  }

  try {
    let result: Record<string, string | boolean> = { handled: false };
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      if (
        event.type === "checkout.session.completed" &&
        event.data.object.payment_status !== "paid"
      ) {
        result = { handled: true, awaitingPayment: true };
      } else {
        result =
          event.data.object.metadata?.kind === "appointment"
            ? await completeAppointment(event.data.object)
            : await completeOrder(event.data.object);
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      if (event.data.object.metadata?.kind === "appointment") {
        await expireAppointment(event.data.object);
      } else {
        await releaseOrder(event.data.object);
      }
      result = { handled: true, released: true };
    }

    await database.webhookEvent.update({
      where: {
        provider_externalEventId: {
          provider: "stripe",
          externalEventId: event.id,
        },
      },
      data: {
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
        result,
      },
    });
    return Response.json({ received: true });
  } catch (error) {
    await database.webhookEvent.update({
      where: {
        provider_externalEventId: {
          provider: "stripe",
          externalEventId: event.id,
        },
      },
      data: {
        status: WebhookStatus.FAILED,
        lastError:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Unknown error",
      },
    });
    return Response.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }

  async function claimWebhook(
    stripeEvent: Stripe.Event,
    rawPayload: string,
  ): Promise<"claimed" | "processed" | "busy"> {
    try {
      await database.webhookEvent.create({
        data: {
          provider: "stripe",
          externalEventId: stripeEvent.id,
          eventType: stripeEvent.type,
          objectId:
            typeof stripeEvent.data.object === "object" &&
            "id" in stripeEvent.data.object
              ? String(stripeEvent.data.object.id)
              : null,
          payloadHash: createHash("sha256").update(rawPayload).digest("hex"),
          status: WebhookStatus.PROCESSING,
        },
      });
      return "claimed";
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )) {
        throw error;
      }
      const existing = await database.webhookEvent.findUniqueOrThrow({
        where: {
          provider_externalEventId: {
            provider: "stripe",
            externalEventId: stripeEvent.id,
          },
        },
      });
      if (existing.status === WebhookStatus.PROCESSED) return "processed";
      const reclaimed = await database.webhookEvent.updateMany({
        where: {
          id: existing.id,
          OR: [
            { status: WebhookStatus.FAILED },
            {
              status: WebhookStatus.PROCESSING,
              updatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
            },
          ],
        },
        data: {
          status: WebhookStatus.PROCESSING,
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      return reclaimed.count === 1 ? "claimed" : "busy";
    }
  }

  async function completeAppointment(session: Stripe.Checkout.Session) {
    const appointmentId = session.metadata?.appointmentId;
    if (!appointmentId) {
      throw new Error("Stripe session is missing appointment metadata");
    }
    const database = requireDatabase();
    const management = createSecureToken();
    const outcome = await withTransactionRetry(() =>
      database.$transaction(
        async (tx) => {
          const current = await tx.appointment.findUniqueOrThrow({
            where: { id: appointmentId },
          });
          await tx.payment.updateMany({
            where: { appointmentId },
            data: {
              status: PaymentStatus.SUCCEEDED,
              processedAt: new Date(),
              paymentMethodType: "card",
              providerMetadata: {
                checkoutSessionId: session.id,
                paymentIntentId:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : null,
              },
            },
          });
          if (current.status === AppointmentStatus.CONFIRMED) {
            await tx.appointmentManagementToken.create({
              data: {
                appointmentId,
                tokenHash: management.hash,
                purpose: AppointmentTokenPurpose.MANAGE,
                expiresAt: addDays(current.endAt, 7),
              },
            });
            return { appointment: current, confirmed: true };
          }
          if (current.status !== AppointmentStatus.PENDING_PAYMENT) {
            const appointment = await tx.appointment.update({
              where: { id: current.id },
              data: {
                internalNotes: [
                  current.internalNotes,
                  "Deposit captured after the appointment hold ended. Manual refund or resolution required.",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            });
            return { appointment, confirmed: false };
          }
          const confirmed = await tx.appointment.update({
            where: { id: appointmentId },
            data: {
              status: AppointmentStatus.CONFIRMED,
              holdExpiresAt: null,
              managementTokens: {
                create: {
                  tokenHash: management.hash,
                  purpose: AppointmentTokenPurpose.MANAGE,
                  expiresAt: addDays(current.endAt, 7),
                },
              },
            },
          });
          const sequence = await tx.appointmentStatusHistory.count({
            where: { appointmentId },
          });
          await tx.appointmentStatusHistory.create({
            data: {
              appointmentId,
              sequence: sequence + 1,
              fromStatus: current.status,
              toStatus: AppointmentStatus.CONFIRMED,
              note: "Deposit confirmed by Stripe webhook",
            },
          });
          return { appointment: confirmed, confirmed: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    const { appointment } = outcome;
    if (!outcome.confirmed) {
      if (appointment.emailSnapshot) {
        await deliverWithoutFailingWebhook(appointment.emailSnapshot, {
          subject: `Action needed for appointment ${appointment.confirmationNumber}`,
          html: "<p>We received your appointment deposit after the reservation window closed. The studio will contact you to confirm a new time or arrange a refund.</p>",
        });
      }
      return {
        handled: true,
        appointmentConfirmed: false,
        requiresManualRefund: true,
      };
    }
    if (!appointment.emailSnapshot) {
      return { handled: true, emailDelivered: false };
    }
    const delivery = await deliverWithoutFailingWebhook(
      appointment.emailSnapshot,
      appointmentConfirmationEmail({
        name: appointment.customerNameSnapshot,
        reference: appointment.confirmationNumber,
        service: appointment.serviceNameSnapshot,
        date: formatInTimeZone(
          appointment.startAt,
          appointment.timezone,
          "PPP 'at' p zzz",
        ),
        manageUrl: `${env.NEXT_PUBLIC_APP_URL}/${appointment.locale}/appointments/manage/${management.token}`,
      }),
    );
    if (!delivery.delivered) {
      await database.appointment.update({
        where: { id: appointment.id },
        data: {
          internalNotes: `Confirmation email pending: ${delivery.error}`,
        },
      });
    }
    return {
      handled: true,
      emailDelivered: delivery.delivered,
      ...(delivery.delivered ? {} : { emailError: delivery.error }),
    };
  }

  async function expireAppointment(session: Stripe.Checkout.Session) {
    const appointmentId = session.metadata?.appointmentId;
    if (!appointmentId) {
      throw new Error("Stripe session is missing appointment metadata");
    }
    const database = requireDatabase();
    await withTransactionRetry(() =>
      database.$transaction([
        database.appointment.updateMany({
          where: {
            id: appointmentId,
            status: AppointmentStatus.PENDING_PAYMENT,
          },
          data: {
            status: AppointmentStatus.EXPIRED,
            holdExpiresAt: new Date(),
          },
        }),
        database.payment.updateMany({
          where: { appointmentId, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.CANCELED },
        }),
      ]),
    );
  }
}

async function completeOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new Error("Stripe session is missing order metadata");
  const database = requireDatabase();
  await withTransactionRetry(() =>
    database.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true, discountRedemption: true },
        });
        if (!order) throw new Error("Webhook order was not found");
        if (order.paymentStatus === PaymentStatus.SUCCEEDED) return;

        for (const item of order.items) {
          if (!item.variantId) continue;
          const inventory = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
          });
          if (!inventory || inventory.quantityReserved < item.quantity) {
            throw new Error(
              `Inventory reservation missing for ${item.skuSnapshot}`,
            );
          }
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantityOnHand: { decrement: item.quantity },
              quantityReserved: { decrement: item.quantity },
              version: { increment: 1 },
            },
          });
          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: inventory.id,
              type: InventoryAdjustmentType.SALE,
              quantityDelta: -item.quantity,
              reason: `Paid order ${order.orderNumber}`,
              referenceType: "order",
              referenceId: order.id,
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            paymentStatus: PaymentStatus.SUCCEEDED,
            placedAt: new Date(),
          },
        });
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: {
            status: PaymentStatus.SUCCEEDED,
            processedAt: new Date(),
            paymentMethodType: "card",
            providerMetadata: {
              checkoutSessionId: session.id,
              paymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : null,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const order = await database.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      emailSnapshot: true,
      customerNameSnapshot: true,
      orderNumber: true,
      grandTotal: true,
      currency: true,
    },
  });
  if (!order.emailSnapshot) {
    return { handled: true, emailDelivered: false };
  }
  const delivery = await deliverWithoutFailingWebhook(
    order.emailSnapshot,
    orderConfirmationEmail({
      name: order.customerNameSnapshot,
      orderNumber: order.orderNumber,
      total: Number(order.grandTotal).toFixed(2),
      currency: order.currency,
    }),
  );
  if (!delivery.delivered) {
    await database.order.update({
      where: { id: orderId },
      data: {
        internalNote: `Confirmation email pending: ${delivery.error}`,
      },
    });
  }
  return {
    handled: true,
    emailDelivered: delivery.delivered,
    ...(delivery.delivered ? {} : { emailError: delivery.error }),
  };
}

async function releaseOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new Error("Stripe session is missing order metadata");
  const database = requireDatabase();
  await withTransactionRetry(() =>
    database.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true, discountRedemption: true },
        });
        if (!order || order.status === OrderStatus.CANCELED) return;
        if (order.paymentStatus === PaymentStatus.SUCCEEDED) return;
        for (const item of order.items) {
          if (!item.variantId) continue;
          const inventory = await tx.inventory.findUnique({
            where: { variantId: item.variantId },
          });
          if (!inventory) continue;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantityReserved: {
                decrement: Math.min(item.quantity, inventory.quantityReserved),
              },
              version: { increment: 1 },
            },
          });
          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: inventory.id,
              type: InventoryAdjustmentType.RELEASE,
              quantityDelta: -Math.min(
                item.quantity,
                inventory.quantityReserved,
              ),
              reason: `Expired checkout ${order.orderNumber}`,
              referenceType: "order",
              referenceId: order.id,
            },
          });
        }
        if (order.discountId && order.discountRedemption) {
          await tx.discountRedemption.delete({
            where: { orderId: order.id },
          });
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

async function deliverWithoutFailingWebhook(
  to: string,
  message: { subject: string; html: string },
): Promise<{ delivered: true } | { delivered: false; error: string }> {
  try {
    const result = await sendEmail({ to, ...message });
    return result.delivered
      ? { delivered: true }
      : { delivered: false, error: result.reason };
  } catch (error) {
    return {
      delivered: false,
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "Unknown delivery error",
    };
  }
}

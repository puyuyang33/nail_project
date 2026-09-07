import {
  DiscountType,
  InventoryAdjustmentType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { checkoutSchema } from "@/features/validation/schemas";
import {
  calculateDiscount,
  calculateSubtotal,
} from "@/features/commerce/pricing";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import { requireStripe } from "@/lib/stripe";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { storeConfig } from "@/config/store";
import { enforceRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/request-security";

class CheckoutError extends Error {
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
  const limit = await enforceRateLimit(
    "checkout",
    getClientIdentifier(request),
  );
  if (!limit.success) {
    return Response.json(
      { error: "Too many checkout attempts. Please wait and try again." },
      { status: 429 },
    );
  }
  const parsed = checkoutSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Checkout details are incomplete or invalid." },
      { status: 400 },
    );
  }

  try {
    const database = requireDatabase();
    const stripe = requireStripe();
    const shipping = storeConfig.shippingMethods.find(
      (method) => method.id === parsed.data.shippingMethodId,
    );
    if (!shipping) throw new CheckoutError("Shipping method is unavailable.");

    const requestedSlugs = parsed.data.items.map((item) => item.productSlug);
    const catalog = await database.product.findMany({
      where: {
        slug: { in: requestedSlugs },
        status: "ACTIVE",
      },
      include: {
        translations: true,
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: {
          where: { isActive: true },
          include: { inventory: true },
        },
        categories: true,
      },
    });
    if (catalog.length !== new Set(requestedSlugs).size) {
      throw new CheckoutError("One or more products are no longer available.");
    }

    const prepared = parsed.data.items.map((requested) => {
      const product = catalog.find(
        (candidate) => candidate.slug === requested.productSlug,
      );
      if (!product)
        throw new CheckoutError("A selected product was not found.");
      const normalized = (value: string | null) => value?.toLowerCase() ?? "";
      const variant = product.variants.find(
        (candidate) =>
          normalized(candidate.shape) === normalized(requested.shape) &&
          normalized(candidate.size) === normalized(requested.size) &&
          normalized(candidate.finish) === normalized(requested.finish),
      );
      if (!variant?.inventory) {
        throw new CheckoutError(
          `${product.slug} is unavailable in the selected configuration.`,
        );
      }
      const translation =
        product.translations.find(
          (item) => item.locale === parsed.data.locale,
        ) ??
        product.translations.find((item) => item.locale === "en") ??
        product.translations[0];
      return {
        requested,
        product,
        variant,
        inventory: variant.inventory,
        name: translation?.name ?? product.slug,
        unitPrice: Number(variant.price),
      };
    });

    const subtotal = calculateSubtotal(
      prepared.map((item) => ({
        unitPrice: item.unitPrice,
        quantity: item.requested.quantity,
      })),
    );
    const discountCode = parsed.data.discountCode?.trim().toUpperCase();
    const discount = discountCode
      ? await database.discount.findFirst({
          where: {
            code: { equals: discountCode, mode: "insensitive" },
            isActive: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
              { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
            ],
          },
          include: { products: true, categories: true },
        })
      : null;
    if (discountCode && !discount) {
      throw new CheckoutError("That discount code is invalid or expired.");
    }
    if (
      discount?.minimumSubtotal &&
      subtotal < Number(discount.minimumSubtotal)
    ) {
      throw new CheckoutError(
        `This code requires a ${storeConfig.currency} ${Number(discount.minimumSubtotal).toFixed(2)} subtotal.`,
      );
    }
    const restrictedProductIds = new Set(
      discount?.products.map((item) => item.productId) ?? [],
    );
    const restrictedCategoryIds = new Set(
      discount?.categories.map((item) => item.categoryId) ?? [],
    );
    const isGlobal =
      restrictedProductIds.size === 0 && restrictedCategoryIds.size === 0;
    const eligibleSubtotal = prepared.reduce((sum, item) => {
      const eligible =
        isGlobal ||
        restrictedProductIds.has(item.product.id) ||
        item.product.categories.some((category) =>
          restrictedCategoryIds.has(category.categoryId),
        );
      return eligible ? sum + item.unitPrice * item.requested.quantity : sum;
    }, 0);
    if (discount && eligibleSubtotal === 0) {
      throw new CheckoutError("That code does not apply to these products.");
    }
    let itemDiscount = 0;
    let shippingTotal = shipping.price;
    if (discount?.type === DiscountType.PERCENTAGE && discount.percentage) {
      itemDiscount = calculateDiscount(eligibleSubtotal, {
        type: "percentage",
        value: Number(discount.percentage),
      });
    } else if (
      discount?.type === DiscountType.FIXED_AMOUNT &&
      discount.amount
    ) {
      itemDiscount = calculateDiscount(eligibleSubtotal, {
        type: "fixed",
        value: Number(discount.amount),
      });
    } else if (discount?.type === DiscountType.FREE_SHIPPING) {
      shippingTotal = 0;
    }
    if (
      discount?.maximumDiscount &&
      itemDiscount > Number(discount.maximumDiscount)
    ) {
      itemDiscount = Number(discount.maximumDiscount);
    }
    const shippingSavings = shipping.price - shippingTotal;
    const discountTotal = itemDiscount + shippingSavings;
    const totals = {
      subtotal,
      discount: discountTotal,
      shipping: shippingTotal,
      tax: 0,
      total: Math.round((subtotal - itemDiscount + shippingTotal) * 100) / 100,
    };
    const orderNumber = `LUN-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`;

    const order = await database.$transaction(
      async (tx) => {
        if (discount) {
          if (discount.usageLimitPerEmail) {
            const uses = await tx.discountRedemption.count({
              where: {
                discountId: discount.id,
                emailNormalized: normalizeEmail(parsed.data.email),
              },
            });
            if (uses >= discount.usageLimitPerEmail) {
              throw new CheckoutError(
                "This discount has already reached its per-customer limit.",
              );
            }
          }
          const reservedDiscount = discount.usageLimit
            ? await tx.discount.updateMany({
                where: {
                  id: discount.id,
                  usageCount: { lt: discount.usageLimit },
                },
                data: { usageCount: { increment: 1 } },
              })
            : {
                count: await tx.discount
                  .update({
                    where: { id: discount.id },
                    data: { usageCount: { increment: 1 } },
                    select: { id: true },
                  })
                  .then(() => 1),
              };
          if (reservedDiscount.count !== 1) {
            throw new CheckoutError(
              "This discount has reached its usage limit.",
            );
          }
        }

        for (const item of prepared) {
          const reserved = await tx.inventory.updateMany({
            where: {
              id: item.inventory.id,
              version: item.inventory.version,
              quantityOnHand: {
                gte: item.inventory.quantityReserved + item.requested.quantity,
              },
            },
            data: {
              quantityReserved: { increment: item.requested.quantity },
              version: { increment: 1 },
            },
          });
          if (reserved.count !== 1) {
            throw new CheckoutError(`${item.name} just sold out.`);
          }
          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: item.inventory.id,
              type: InventoryAdjustmentType.RESERVATION,
              quantityDelta: item.requested.quantity,
              reason: `Checkout reservation ${orderNumber}`,
              referenceType: "order",
              referenceId: orderNumber,
            },
          });
        }

        return tx.order.create({
          data: {
            orderNumber,
            status: OrderStatus.PENDING_PAYMENT,
            paymentStatus: PaymentStatus.PENDING,
            discountId: discount?.id,
            locale: parsed.data.locale,
            currency: storeConfig.currency,
            customerNameSnapshot: parsed.data.name,
            emailSnapshot: parsed.data.email,
            emailNormalized: normalizeEmail(parsed.data.email),
            phoneSnapshot: parsed.data.phone || null,
            phoneNormalized: parsed.data.phone
              ? normalizePhone(parsed.data.phone)
              : null,
            shippingAddressSnapshot: parsed.data.address,
            billingAddressSnapshot: parsed.data.address,
            subtotal: totals.subtotal,
            discountTotal: totals.discount,
            shippingTotal: totals.shipping,
            taxTotal: totals.tax,
            grandTotal: totals.total,
            shippingMethodSnapshot: shipping,
            discountCodeSnapshot: discount?.code,
            items: {
              create: prepared.map((item, index) => ({
                lineNumber: index + 1,
                productId: item.product.id,
                variantId: item.variant.id,
                productNameSnapshot: item.name,
                variantNameSnapshot: item.variant.name,
                skuSnapshot: item.variant.sku,
                imageUrlSnapshot: item.product.images[0]?.url,
                unitPrice: item.unitPrice,
                quantity: item.requested.quantity,
                subtotal: item.unitPrice * item.requested.quantity,
                total: item.unitPrice * item.requested.quantity,
                productSnapshot: {
                  slug: item.product.slug,
                  name: item.name,
                },
                customization: {
                  shape: item.requested.shape,
                  size: item.requested.size,
                  finish: item.requested.finish,
                  customSizing: item.requested.customSizing,
                },
              })),
            },
            payments: {
              create: {
                provider: PaymentProvider.STRIPE,
                status: PaymentStatus.PENDING,
                amount: totals.total,
                currency: storeConfig.currency,
                idempotencyKey: `checkout:${orderNumber}`,
              },
            },
            ...(discount
              ? {
                  discountRedemption: {
                    create: {
                      discountId: discount.id,
                      emailNormalized: normalizeEmail(parsed.data.email),
                      amount: totals.discount,
                    },
                  },
                }
              : {}),
          },
          include: { items: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          customer_email: parsed.data.email,
          client_reference_id: order.id,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
          payment_intent_data: {
            metadata: { orderId: order.id, orderNumber: order.orderNumber },
          },
          line_items: discount
            ? [
                {
                  quantity: 1,
                  price_data: {
                    currency: order.currency.toLowerCase(),
                    unit_amount: Math.round(totals.total * 100),
                    product_data: {
                      name: `${storeConfig.name} order ${order.orderNumber}`,
                      description: `${order.items.reduce((sum, item) => sum + item.quantity, 0)} items · ${discount.code}`,
                    },
                  },
                },
              ]
            : [
                ...order.items.map((item) => ({
                  quantity: item.quantity,
                  price_data: {
                    currency: order.currency.toLowerCase(),
                    unit_amount: Math.round(Number(item.unitPrice) * 100),
                    product_data: {
                      name: item.productNameSnapshot,
                      images: item.imageUrlSnapshot
                        ? [item.imageUrlSnapshot]
                        : [],
                      metadata: { sku: item.skuSnapshot },
                    },
                  },
                })),
                ...(Number(order.shippingTotal) > 0
                  ? [
                      {
                        quantity: 1,
                        price_data: {
                          currency: order.currency.toLowerCase(),
                          unit_amount: Math.round(
                            Number(order.shippingTotal) * 100,
                          ),
                          product_data: { name: shipping.label },
                        },
                      },
                    ]
                  : []),
              ],
          success_url: `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/orders/confirmation?order=${order.orderNumber}`,
          cancel_url: `${env.NEXT_PUBLIC_APP_URL}/${parsed.data.locale}/checkout`,
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
        { idempotencyKey: `checkout:${order.orderNumber}` },
      );
      await database.payment.updateMany({
        where: { orderId: order.id, provider: PaymentProvider.STRIPE },
        data: {
          providerPaymentId: session.id,
          providerMetadata: { checkoutSessionId: session.id },
        },
      });
      if (!session.url) {
        throw new CheckoutError("Stripe did not return a checkout URL.", 502);
      }
      return Response.json({ url: session.url });
    } catch (error) {
      await database.$transaction(async (tx) => {
        for (const item of prepared) {
          await tx.inventory.update({
            where: { id: item.inventory.id },
            data: {
              quantityReserved: { decrement: item.requested.quantity },
              version: { increment: 1 },
            },
          });
          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: item.inventory.id,
              type: InventoryAdjustmentType.RELEASE,
              quantityDelta: -item.requested.quantity,
              reason: `Checkout initialization failed ${order.orderNumber}`,
              referenceType: "order",
              referenceId: order.id,
            },
          });
        }
        if (discount) {
          await tx.discountRedemption.deleteMany({
            where: { orderId: order.id },
          });
          await tx.discount.update({
            where: { id: discount.id },
            data: { usageCount: { decrement: 1 } },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELED,
            paymentStatus: PaymentStatus.FAILED,
            canceledAt: new Date(),
          },
        });
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof CheckoutError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error && error.message.includes("not configured")
        ? error.message
        : "Secure checkout is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}

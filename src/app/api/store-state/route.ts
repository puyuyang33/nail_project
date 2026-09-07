import { CartStatus, Prisma, ProductStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { requireDatabase } from "@/lib/db";
import { env, serviceReadiness } from "@/lib/env";
import { rejectUntrustedOrigin } from "@/lib/request-security";
import { createSecureToken, hashToken } from "@/lib/tokens";

const cookieName = "lunaria-store-session";
const stateSchema = z.object({
  cart: z
    .array(
      z.object({
        productId: z.string().min(1),
        slug: z.string().min(1),
        quantity: z.number().int().min(1).max(10),
        shape: z.string().min(1).max(50),
        size: z.string().min(1).max(50),
        finish: z.string().min(1).max(50),
        customSizing: z.string().trim().max(200).optional(),
      }),
    )
    .max(50),
  wishlist: z.array(z.string().min(1)).max(100),
});

export async function GET(request: Request) {
  if (!serviceReadiness.database) {
    return NextResponse.json({ mode: "local", cart: [], wishlist: [] });
  }
  const owner = await getOwner();
  const database = requireDatabase();
  const locale =
    new URL(request.url).searchParams.get("locale") === "zh" ? "zh" : "en";
  const [cart, wishlist] = await Promise.all([
    database.cart.findFirst({
      where: owner.userId
        ? { userId: owner.userId, status: CartStatus.ACTIVE }
        : { sessionTokenHash: owner.tokenHash, status: CartStatus.ACTIVE },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    translations: true,
                    images: { orderBy: { position: "asc" }, take: 1 },
                  },
                },
              },
            },
          },
        },
      },
    }),
    database.wishlist.findFirst({
      where: owner.userId
        ? { userId: owner.userId }
        : { sessionTokenHash: owner.tokenHash },
      include: { items: true },
    }),
  ]);
  const response = NextResponse.json({
    mode: "database",
    cart:
      cart?.items.map((item) => {
        const translation =
          item.variant.product.translations.find(
            (entry) => entry.locale === locale,
          ) ??
          item.variant.product.translations.find(
            (entry) => entry.locale === "en",
          ) ??
          item.variant.product.translations[0];
        const customization = isRecord(item.customization)
          ? item.customization
          : {};
        return {
          lineId: item.lineKey,
          productId: item.variant.product.id,
          slug: item.variant.product.slug,
          name: translation?.name ?? item.variant.product.slug,
          image: item.variant.product.images[0]?.url ?? "",
          price: Number(item.unitPriceSnapshot),
          quantity: item.quantity,
          shape: item.variant.shape ?? "Standard",
          size: item.variant.size ?? "Standard",
          finish: item.variant.finish ?? "Standard",
          customSizing:
            typeof customization.customSizing === "string"
              ? customization.customSizing
              : undefined,
        };
      }) ?? [],
    wishlist: wishlist?.items.map((item) => item.productId) ?? [],
  });
  setOwnerCookie(response, owner);
  return response;
}

export async function PUT(request: Request) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  if (!serviceReadiness.database) {
    return NextResponse.json({ mode: "local" });
  }
  const parsed = stateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Store state is invalid." },
      { status: 400 },
    );
  }
  const owner = await getOwner();
  const database = requireDatabase();
  const productIds = [
    ...new Set([
      ...parsed.data.cart.map((line) => line.productId),
      ...parsed.data.wishlist,
    ]),
  ];
  const products = await database.product.findMany({
    where: { id: { in: productIds }, status: ProductStatus.ACTIVE },
    include: {
      variants: { where: { isActive: true } },
    },
  });
  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: "One or more saved products are unavailable." },
      { status: 409 },
    );
  }

  await database.$transaction(async (tx) => {
    const cart = await findOrCreateCart(tx, owner);
    const wishlist = await findOrCreateWishlist(tx, owner);
    await Promise.all([
      tx.cartItem.deleteMany({ where: { cartId: cart.id } }),
      tx.wishlistItem.deleteMany({ where: { wishlistId: wishlist.id } }),
    ]);
    for (const line of parsed.data.cart) {
      const product = products.find((item) => item.id === line.productId);
      const normalize = (value: string | null) => value?.toLowerCase() ?? "";
      const variant = product?.variants.find(
        (item) =>
          normalize(item.shape) === normalize(line.shape) &&
          normalize(item.size) === normalize(line.size) &&
          normalize(item.finish) === normalize(line.finish),
      );
      if (!product || !variant) continue;
      await tx.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: variant.id,
          lineKey: [
            product.id,
            line.shape,
            line.size,
            line.finish,
            line.customSizing ?? "",
          ].join(":"),
          quantity: line.quantity,
          unitPriceSnapshot: variant.price,
          customization: line.customSizing
            ? { customSizing: line.customSizing }
            : undefined,
        },
      });
    }
    for (const productId of parsed.data.wishlist) {
      await tx.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId,
          selectionKey: productId,
        },
      });
    }
    await tx.cart.update({
      where: { id: cart.id },
      data: { lastActivityAt: new Date() },
    });
  });

  const response = NextResponse.json({ mode: "database", saved: true });
  setOwnerCookie(response, owner);
  return response;
}

type StoreOwner = {
  userId: string | null;
  rawToken: string | null;
  tokenHash: string | null;
  createdToken: boolean;
};

async function getOwner(): Promise<StoreOwner> {
  const session = await auth();
  if (session?.user.id) {
    return {
      userId: session.user.id,
      rawToken: null,
      tokenHash: null,
      createdToken: false,
    };
  }
  const cookieStore = await cookies();
  const existing = cookieStore.get(cookieName)?.value;
  if (existing) {
    return {
      userId: null,
      rawToken: existing,
      tokenHash: hashToken(existing),
      createdToken: false,
    };
  }
  const created = createSecureToken();
  return {
    userId: null,
    rawToken: created.token,
    tokenHash: created.hash,
    createdToken: true,
  };
}

function setOwnerCookie(response: NextResponse, owner: StoreOwner) {
  if (!owner.createdToken || !owner.rawToken) return;
  response.cookies.set(cookieName, owner.rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function findOrCreateCart(
  tx: Prisma.TransactionClient,
  owner: StoreOwner,
) {
  const existing = await tx.cart.findFirst({
    where: owner.userId
      ? { userId: owner.userId, status: CartStatus.ACTIVE }
      : { sessionTokenHash: owner.tokenHash, status: CartStatus.ACTIVE },
  });
  return (
    existing ??
    tx.cart.create({
      data: owner.userId
        ? { userId: owner.userId }
        : {
            sessionTokenHash: owner.tokenHash!,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
    })
  );
}

async function findOrCreateWishlist(
  tx: Prisma.TransactionClient,
  owner: StoreOwner,
) {
  const existing = await tx.wishlist.findFirst({
    where: owner.userId
      ? { userId: owner.userId }
      : { sessionTokenHash: owner.tokenHash },
  });
  return (
    existing ??
    tx.wishlist.create({
      data: owner.userId
        ? { userId: owner.userId }
        : {
            sessionTokenHash: owner.tokenHash!,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

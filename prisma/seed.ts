import "dotenv/config";

import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  AppointmentStatus,
  AppointmentTokenPurpose,
  BlockedTimeType,
  CartStatus,
  ContactMethod,
  DayOfWeek,
  DiscountType,
  InventoryAdjustmentType,
  NewsletterStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  PrismaClient,
  ProductStatus,
  ProductType,
  ReviewStatus,
  ShipmentStatus,
  UserRole,
  UserStatus,
  WebhookStatus,
  WholesaleApplicationStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

type LocalizedContent = {
  locale: "en" | "zh";
  name: string;
  description?: string;
  shortDescription?: string;
  seoTitle?: string;
  seoDescription?: string;
};

type ProductSeed = {
  slug: string;
  type: ProductType;
  basePrice: string;
  compareAtPrice?: string;
  isCustomizable?: boolean;
  isFeatured?: boolean;
  metadata?: Prisma.InputJsonValue;
  translations: [LocalizedContent, LocalizedContent];
  images: Array<{
    url: string;
    altText: string;
    altTextZh: string;
    width: number;
    height: number;
  }>;
  variants: Array<{
    sku: string;
    name: string;
    optionValues: Prisma.InputJsonValue;
    size?: string;
    shape?: string;
    length?: string;
    color?: string;
    finish?: string;
    setQuantity?: number;
    price: string;
    stock: number;
    reorderLevel: number;
    weightGrams?: number;
  }>;
  categories: string[];
  collections: string[];
  tags: string[];
};

type ServiceSeed = {
  slug: string;
  basePrice: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  depositAmount?: string;
  position: number;
  imageUrl: string;
  translations: [LocalizedContent, LocalizedContent];
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the Prisma seed.");
}

const adminEmail = (
  process.env.SEED_ADMIN_EMAIL ??
  process.env.ADMIN_EMAIL ??
  ""
)
  .trim()
  .toLowerCase();
const adminPassword =
  process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const adminName =
  (
    process.env.SEED_ADMIN_NAME ??
    process.env.ADMIN_NAME ??
    "Store Administrator"
  ).trim() || "Store Administrator";

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  throw new Error(
    "Set SEED_ADMIN_EMAIL (or ADMIN_EMAIL) to a valid email address before seeding.",
  );
}

const passwordBytes = Buffer.byteLength(adminPassword, "utf8");
if (passwordBytes < 12 || passwordBytes > 72) {
  throw new Error(
    "SEED_ADMIN_PASSWORD (or ADMIN_PASSWORD) must be between 12 and 72 UTF-8 bytes.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const money = (value: string | number) => new Prisma.Decimal(value);
const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const categorySeeds = [
  {
    slug: "press-on-sets",
    position: 10,
    translations: [
      {
        locale: "en",
        name: "Press-On Nail Sets",
        description:
          "Reusable, hand-finished nail sets made for an effortless salon look.",
      },
      {
        locale: "zh",
        name: "穿戴甲套装",
        description: "可重复佩戴的手工精饰甲片，轻松呈现沙龙级效果。",
      },
    ],
  },
  {
    slug: "nail-supplies",
    position: 20,
    translations: [
      {
        locale: "en",
        name: "Application Supplies",
        description:
          "Thoughtful tools for secure application, care, and removal.",
      },
      {
        locale: "zh",
        name: "美甲工具",
        description: "用于稳固佩戴、日常护理与温和卸除的实用工具。",
      },
    ],
  },
  {
    slug: "accessories",
    position: 30,
    translations: [
      {
        locale: "en",
        name: "Accessories",
        description:
          "Finishing touches for storing, styling, and gifting nail sets.",
      },
      {
        locale: "zh",
        name: "配件",
        description: "适合收纳、造型与赠礼的精致配件。",
      },
    ],
  },
] satisfies Array<{
  slug: string;
  position: number;
  translations: LocalizedContent[];
}>;

const collectionSeeds = [
  {
    slug: "quiet-luminescence",
    imageUrl:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1600&q=85",
    position: 10,
    isFeatured: true,
    translations: [
      {
        locale: "en",
        name: "Quiet Luminescence",
        description:
          "Pearlescent color, translucent layers, and subtle glints inspired by evening light.",
      },
      {
        locale: "zh",
        name: "静谧微光",
        description: "以夜色为灵感，融合珍珠光泽、通透层次与细腻闪烁。",
      },
    ],
  },
  {
    slug: "studio-essentials",
    imageUrl:
      "https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=1600&q=85",
    position: 20,
    isFeatured: true,
    translations: [
      {
        locale: "en",
        name: "Studio Essentials",
        description:
          "Reliable preparation and care tools for a polished at-home ritual.",
      },
      {
        locale: "zh",
        name: "工作室精选工具",
        description: "为居家美甲仪式准备的可靠护理与佩戴工具。",
      },
    ],
  },
] satisfies Array<{
  slug: string;
  imageUrl: string;
  position: number;
  isFeatured: boolean;
  translations: LocalizedContent[];
}>;

const tagSeeds = [
  {
    slug: "hand-finished",
    translations: [
      { locale: "en", name: "Hand-finished" },
      { locale: "zh", name: "手工精饰" },
    ],
  },
  {
    slug: "reusable",
    translations: [
      { locale: "en", name: "Reusable" },
      { locale: "zh", name: "可重复佩戴" },
    ],
  },
  {
    slug: "soft-shimmer",
    translations: [
      { locale: "en", name: "Soft shimmer" },
      { locale: "zh", name: "柔和微闪" },
    ],
  },
  {
    slug: "beginner-friendly",
    translations: [
      { locale: "en", name: "Beginner friendly" },
      { locale: "zh", name: "新手友好" },
    ],
  },
] satisfies Array<{
  slug: string;
  translations: LocalizedContent[];
}>;

const productSeeds: ProductSeed[] = [
  {
    slug: "moonlit-pearl-almond-set",
    type: ProductType.PRESS_ON_SET,
    basePrice: "38.00",
    compareAtPrice: "44.00",
    isFeatured: true,
    metadata: {
      care: "Avoid prolonged water exposure for the first two hours.",
      includes: [
        "24 nails",
        "adhesive tabs",
        "file",
        "prep wipe",
        "wooden stick",
      ],
    },
    translations: [
      {
        locale: "en",
        name: "Moonlit Pearl Almond Set",
        shortDescription: "A milky almond set with a fine, moonlit pearl veil.",
        description:
          "Soft ivory layers and a restrained pearl sheen make this reusable set equally suited to daily wear and celebrations. Each set is hand-finished for gentle dimension.",
        seoTitle: "Moonlit Pearl Reusable Press-On Nails",
        seoDescription: "Reusable almond press-on nails in soft ivory pearl.",
      },
      {
        locale: "zh",
        name: "月影珍珠杏仁甲",
        shortDescription: "乳白杏仁甲型，覆以月光般细腻珠光。",
        description:
          "柔和象牙白层次搭配克制的珍珠光泽，日常与特别场合皆宜。每副甲片均手工精饰，呈现轻盈立体感。",
        seoTitle: "月影珍珠可重复佩戴穿戴甲",
        seoDescription: "柔和象牙白珠光杏仁形可重复佩戴穿戴甲。",
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1400&q=85",
        altText:
          "Pearl ivory almond press-on nails arranged on a neutral surface",
        altTextZh: "摆放在中性色背景上的珍珠象牙白杏仁形穿戴甲",
        width: 1400,
        height: 1750,
      },
      {
        url: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1400&q=85",
        altText: "Close view of softly shimmering neutral nails",
        altTextZh: "柔和微闪中性色美甲细节",
        width: 1400,
        height: 1750,
      },
    ],
    variants: [
      {
        sku: "LUMA-MPA-S",
        name: "Small / Almond / Medium",
        optionValues: { size: "small", shape: "almond", length: "medium" },
        size: "Small",
        shape: "Almond",
        length: "Medium",
        color: "Pearl ivory",
        finish: "Shimmer",
        setQuantity: 24,
        price: "38.00",
        stock: 18,
        reorderLevel: 5,
        weightGrams: 35,
      },
      {
        sku: "LUMA-MPA-M",
        name: "Medium / Almond / Medium",
        optionValues: { size: "medium", shape: "almond", length: "medium" },
        size: "Medium",
        shape: "Almond",
        length: "Medium",
        color: "Pearl ivory",
        finish: "Shimmer",
        setQuantity: 24,
        price: "38.00",
        stock: 26,
        reorderLevel: 6,
        weightGrams: 35,
      },
    ],
    categories: ["press-on-sets"],
    collections: ["quiet-luminescence"],
    tags: ["hand-finished", "reusable", "soft-shimmer"],
  },
  {
    slug: "jade-mist-sculpted-set",
    type: ProductType.PRESS_ON_SET,
    basePrice: "42.00",
    isCustomizable: true,
    isFeatured: true,
    metadata: {
      design: "Translucent sage layers with hand-painted mineral lines.",
      sizing: "Standard and custom measurement options are available.",
    },
    translations: [
      {
        locale: "en",
        name: "Jade Mist Sculpted Set",
        shortDescription:
          "Translucent sage with delicate mineral-inspired lines.",
        description:
          "A calm green palette is layered with hand-painted veining and a glassy finish. Choose a standard fit or submit custom measurements for a made-to-order set.",
        seoTitle: "Jade Mist Custom Press-On Nail Set",
        seoDescription:
          "Hand-finished sage press-on nails with standard or custom sizing.",
      },
      {
        locale: "zh",
        name: "翡翠雾影定制甲",
        shortDescription: "通透鼠尾草绿搭配矿石灵感细线。",
        description:
          "沉静绿色层叠手绘纹理与玻璃光泽，可选择标准尺码，亦可提交尺寸定制专属甲片。",
        seoTitle: "翡翠雾影定制穿戴甲",
        seoDescription: "手工精饰鼠尾草绿色穿戴甲，支持标准与定制尺寸。",
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1400&q=85",
        altText: "Glossy sage green sculpted nail design",
        altTextZh: "光泽鼠尾草绿色立体美甲设计",
        width: 1400,
        height: 1750,
      },
    ],
    variants: [
      {
        sku: "LUMA-JMS-M",
        name: "Medium / Oval / Short",
        optionValues: { size: "medium", shape: "oval", length: "short" },
        size: "Medium",
        shape: "Oval",
        length: "Short",
        color: "Sage",
        finish: "Gloss",
        setQuantity: 24,
        price: "42.00",
        stock: 14,
        reorderLevel: 4,
        weightGrams: 34,
      },
      {
        sku: "LUMA-JMS-CUSTOM",
        name: "Custom sizing / Oval / Short",
        optionValues: { size: "custom", shape: "oval", length: "short" },
        size: "Custom",
        shape: "Oval",
        length: "Short",
        color: "Sage",
        finish: "Gloss",
        setQuantity: 10,
        price: "48.00",
        stock: 40,
        reorderLevel: 10,
        weightGrams: 32,
      },
    ],
    categories: ["press-on-sets"],
    collections: ["quiet-luminescence"],
    tags: ["hand-finished", "reusable"],
  },
  {
    slug: "rosewater-glaze-short-set",
    type: ProductType.PRESS_ON_SET,
    basePrice: "34.00",
    isFeatured: false,
    metadata: {
      finish: "High-gloss translucent rose",
      includes: ["24 nails", "adhesive tabs", "file", "prep wipe"],
    },
    translations: [
      {
        locale: "en",
        name: "Rosewater Glaze Short Set",
        shortDescription:
          "A translucent blush wash on an easy short-round shape.",
        description:
          "A sheer rose tint and glass-like shine create a clean, understated manicure. The practical short length is designed for comfortable everyday wear.",
        seoTitle: "Rosewater Glaze Short Press-On Nails",
        seoDescription:
          "Reusable short-round press-on nails with a translucent rose finish.",
      },
      {
        locale: "zh",
        name: "玫瑰水光短圆甲",
        shortDescription: "通透浅粉水光，搭配轻松实用的短圆甲型。",
        description:
          "轻透玫瑰色与玻璃般亮泽呈现干净克制的美感，舒适短款设计适合每日佩戴。",
        seoTitle: "玫瑰水光短圆穿戴甲",
        seoDescription: "通透玫瑰色、可重复佩戴的短圆形穿戴甲。",
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=1400&q=85",
        altText: "Short glossy rose-toned manicure",
        altTextZh: "短款亮泽玫瑰色美甲",
        width: 1400,
        height: 1750,
      },
    ],
    variants: [
      {
        sku: "LUMA-RGS-S",
        name: "Small / Round / Short",
        optionValues: { size: "small", shape: "round", length: "short" },
        size: "Small",
        shape: "Round",
        length: "Short",
        color: "Sheer rose",
        finish: "Gloss",
        setQuantity: 24,
        price: "34.00",
        stock: 31,
        reorderLevel: 8,
        weightGrams: 30,
      },
      {
        sku: "LUMA-RGS-M",
        name: "Medium / Round / Short",
        optionValues: { size: "medium", shape: "round", length: "short" },
        size: "Medium",
        shape: "Round",
        length: "Short",
        color: "Sheer rose",
        finish: "Gloss",
        setQuantity: 24,
        price: "34.00",
        stock: 29,
        reorderLevel: 8,
        weightGrams: 30,
      },
    ],
    categories: ["press-on-sets"],
    collections: ["quiet-luminescence"],
    tags: ["reusable", "beginner-friendly"],
  },
  {
    slug: "complete-application-care-kit",
    type: ProductType.SUPPLY,
    basePrice: "18.00",
    isFeatured: true,
    metadata: {
      includes: [
        "adhesive tabs",
        "nail glue",
        "mini file",
        "buffer",
        "prep wipes",
        "wooden stick",
      ],
    },
    translations: [
      {
        locale: "en",
        name: "Complete Application & Care Kit",
        shortDescription:
          "Everything needed to prep, apply, remove, and rewear.",
        description:
          "A compact toolkit for a clean application and gentle removal. It includes both adhesive tabs and nail glue, so wear time can match the occasion.",
        seoTitle: "Press-On Nail Application and Care Kit",
        seoDescription:
          "A complete beginner-friendly kit for applying and removing press-on nails.",
      },
      {
        locale: "zh",
        name: "全套佩戴护理工具包",
        shortDescription: "从甲面准备、佩戴到温和卸除与重复使用，一套齐备。",
        description:
          "便携工具包帮助完成干净佩戴与温和卸除，同时配有果冻胶与甲片胶，可按场合选择佩戴时长。",
        seoTitle: "穿戴甲佩戴与护理工具包",
        seoDescription: "适合新手的穿戴甲佩戴与卸除全套工具。",
      },
    ],
    images: [
      {
        url: "https://images.unsplash.com/photo-1599948128020-9a44505b0d1b?auto=format&fit=crop&w=1400&q=85",
        altText: "Nail preparation and care tools arranged in a compact kit",
        altTextZh: "整齐摆放的便携美甲准备与护理工具",
        width: 1400,
        height: 1750,
      },
    ],
    variants: [
      {
        sku: "LUMA-CARE-KIT",
        name: "Complete kit",
        optionValues: { pack: "complete-kit" },
        setQuantity: 1,
        price: "18.00",
        stock: 45,
        reorderLevel: 12,
        weightGrams: 120,
      },
    ],
    categories: ["nail-supplies"],
    collections: ["studio-essentials"],
    tags: ["beginner-friendly"],
  },
];

const serviceSeeds: ServiceSeed[] = [
  {
    slug: "signature-gel-manicure",
    basePrice: "55.00",
    durationMinutes: 60,
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 10,
    position: 10,
    imageUrl:
      "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?auto=format&fit=crop&w=1400&q=85",
    translations: [
      {
        locale: "en",
        name: "Signature Gel Manicure",
        shortDescription:
          "Detailed cuticle care, shaping, and a durable gel finish.",
        description:
          "A restorative manicure with precise preparation, personalized shaping, and your choice of a refined solid or sheer gel color.",
      },
      {
        locale: "zh",
        name: "经典凝胶美甲",
        shortDescription: "细致甘皮护理、修形与持久凝胶上色。",
        description: "包含温和护理、个性化修形，并可选择精致纯色或通透凝胶色。",
      },
    ],
  },
  {
    slug: "press-on-design-consultation",
    basePrice: "35.00",
    durationMinutes: 45,
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 10,
    depositAmount: "15.00",
    position: 20,
    imageUrl:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1400&q=85",
    translations: [
      {
        locale: "en",
        name: "Press-On Design Consultation",
        shortDescription:
          "Sizing, palette planning, and a custom design brief.",
        description:
          "Meet with an artist to confirm measurements, shape, length, colors, and design direction for a made-to-order press-on set.",
      },
      {
        locale: "zh",
        name: "穿戴甲定制咨询",
        shortDescription: "确认尺寸、配色方案与定制设计方向。",
        description:
          "与美甲师共同确认尺寸、甲型、长度、颜色和设计方向，打造专属穿戴甲。",
      },
    ],
  },
  {
    slug: "structured-gel-rebalance",
    basePrice: "72.00",
    durationMinutes: 90,
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 15,
    depositAmount: "20.00",
    position: 30,
    imageUrl:
      "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1400&q=85",
    translations: [
      {
        locale: "en",
        name: "Structured Gel Rebalance",
        shortDescription: "Shape correction and structured gel maintenance.",
        description:
          "A careful rebalance for existing structured gel, including removal of lifting, apex refinement, shaping, and a fresh color.",
      },
      {
        locale: "zh",
        name: "建构凝胶平衡护理",
        shortDescription: "甲型修正与建构凝胶维护。",
        description:
          "针对已有建构凝胶进行细致维护，处理翘起、调整弧度、修形并重新上色。",
      },
    ],
  },
];

async function seedCategory(
  tx: Prisma.TransactionClient,
  seed: (typeof categorySeeds)[number],
) {
  const category = await tx.category.upsert({
    where: { slug: seed.slug },
    update: {
      position: seed.position,
      isActive: true,
    },
    create: {
      slug: seed.slug,
      position: seed.position,
      isActive: true,
    },
  });

  for (const translation of seed.translations) {
    await tx.categoryTranslation.upsert({
      where: {
        categoryId_locale: {
          categoryId: category.id,
          locale: translation.locale,
        },
      },
      update: {
        name: translation.name,
        description: translation.description ?? null,
      },
      create: {
        categoryId: category.id,
        locale: translation.locale,
        name: translation.name,
        description: translation.description ?? null,
      },
    });
  }

  return category;
}

async function seedCollection(
  tx: Prisma.TransactionClient,
  seed: (typeof collectionSeeds)[number],
) {
  const collection = await tx.collection.upsert({
    where: { slug: seed.slug },
    update: {
      imageUrl: seed.imageUrl,
      position: seed.position,
      isFeatured: seed.isFeatured,
      isActive: true,
    },
    create: {
      slug: seed.slug,
      imageUrl: seed.imageUrl,
      position: seed.position,
      isFeatured: seed.isFeatured,
      isActive: true,
    },
  });

  for (const translation of seed.translations) {
    await tx.collectionTranslation.upsert({
      where: {
        collectionId_locale: {
          collectionId: collection.id,
          locale: translation.locale,
        },
      },
      update: {
        name: translation.name,
        description: translation.description ?? null,
      },
      create: {
        collectionId: collection.id,
        locale: translation.locale,
        name: translation.name,
        description: translation.description ?? null,
      },
    });
  }

  return collection;
}

async function seedTag(
  tx: Prisma.TransactionClient,
  seed: (typeof tagSeeds)[number],
) {
  const tag = await tx.tag.upsert({
    where: { slug: seed.slug },
    update: {},
    create: { slug: seed.slug },
  });

  for (const translation of seed.translations) {
    await tx.tagTranslation.upsert({
      where: {
        tagId_locale: {
          tagId: tag.id,
          locale: translation.locale,
        },
      },
      update: { name: translation.name },
      create: {
        tagId: tag.id,
        locale: translation.locale,
        name: translation.name,
      },
    });
  }

  return tag;
}

async function seedProduct(
  tx: Prisma.TransactionClient,
  seed: ProductSeed,
  categoryIds: ReadonlyMap<string, string>,
  collectionIds: ReadonlyMap<string, string>,
  tagIds: ReadonlyMap<string, string>,
) {
  const product = await tx.product.upsert({
    where: { slug: seed.slug },
    update: {
      type: seed.type,
      status: ProductStatus.ACTIVE,
      basePrice: money(seed.basePrice),
      compareAtPrice: seed.compareAtPrice ? money(seed.compareAtPrice) : null,
      currency: "USD",
      trackInventory: true,
      allowBackorder: false,
      isCustomizable: seed.isCustomizable ?? false,
      isFeatured: seed.isFeatured ?? false,
      requiresShipping: true,
      metadata: seed.metadata,
      publishedAt: new Date("2026-01-15T12:00:00.000Z"),
      archivedAt: null,
    },
    create: {
      slug: seed.slug,
      type: seed.type,
      status: ProductStatus.ACTIVE,
      basePrice: money(seed.basePrice),
      compareAtPrice: seed.compareAtPrice ? money(seed.compareAtPrice) : null,
      currency: "USD",
      trackInventory: true,
      allowBackorder: false,
      isCustomizable: seed.isCustomizable ?? false,
      isFeatured: seed.isFeatured ?? false,
      requiresShipping: true,
      metadata: seed.metadata,
      publishedAt: new Date("2026-01-15T12:00:00.000Z"),
    },
  });

  for (const translation of seed.translations) {
    await tx.productTranslation.upsert({
      where: {
        productId_locale: {
          productId: product.id,
          locale: translation.locale,
        },
      },
      update: {
        name: translation.name,
        shortDescription: translation.shortDescription ?? null,
        description: translation.description ?? "",
        seoTitle: translation.seoTitle ?? null,
        seoDescription: translation.seoDescription ?? null,
      },
      create: {
        productId: product.id,
        locale: translation.locale,
        name: translation.name,
        shortDescription: translation.shortDescription ?? null,
        description: translation.description ?? "",
        seoTitle: translation.seoTitle ?? null,
        seoDescription: translation.seoDescription ?? null,
      },
    });
  }

  for (const [position, image] of seed.images.entries()) {
    await tx.productImage.upsert({
      where: {
        productId_position: {
          productId: product.id,
          position,
        },
      },
      update: {
        url: image.url,
        altText: image.altText,
        altTextZh: image.altTextZh,
        width: image.width,
        height: image.height,
        format: "jpg",
        position,
        isPrimary: position === 0,
      },
      create: {
        productId: product.id,
        url: image.url,
        altText: image.altText,
        altTextZh: image.altTextZh,
        width: image.width,
        height: image.height,
        format: "jpg",
        position,
        isPrimary: position === 0,
      },
    });
  }

  for (const [position, variantSeed] of seed.variants.entries()) {
    const variant = await tx.productVariant.upsert({
      where: { sku: variantSeed.sku },
      update: {
        productId: product.id,
        name: variantSeed.name,
        optionValues: variantSeed.optionValues,
        size: variantSeed.size ?? null,
        shape: variantSeed.shape ?? null,
        length: variantSeed.length ?? null,
        color: variantSeed.color ?? null,
        finish: variantSeed.finish ?? null,
        setQuantity: variantSeed.setQuantity ?? null,
        price: money(variantSeed.price),
        weightGrams: variantSeed.weightGrams ?? null,
        isActive: true,
        position,
      },
      create: {
        productId: product.id,
        sku: variantSeed.sku,
        name: variantSeed.name,
        optionValues: variantSeed.optionValues,
        size: variantSeed.size ?? null,
        shape: variantSeed.shape ?? null,
        length: variantSeed.length ?? null,
        color: variantSeed.color ?? null,
        finish: variantSeed.finish ?? null,
        setQuantity: variantSeed.setQuantity ?? null,
        price: money(variantSeed.price),
        weightGrams: variantSeed.weightGrams ?? null,
        isActive: true,
        position,
      },
    });

    const inventory = await tx.inventory.upsert({
      where: { variantId: variant.id },
      update: {
        reorderLevel: variantSeed.reorderLevel,
      },
      create: {
        variantId: variant.id,
        quantityOnHand: variantSeed.stock,
        quantityReserved: 0,
        reorderLevel: variantSeed.reorderLevel,
      },
    });

    await tx.inventoryAdjustment.upsert({
      where: { id: `seed-stock-${variantSeed.sku.toLowerCase()}` },
      update: {
        reason: "Initial template inventory snapshot",
      },
      create: {
        id: `seed-stock-${variantSeed.sku.toLowerCase()}`,
        inventoryId: inventory.id,
        type: InventoryAdjustmentType.RECEIPT,
        quantityDelta: variantSeed.stock,
        reason: "Initial template inventory snapshot",
        referenceType: "seed",
        referenceId: variantSeed.sku,
      },
    });
  }

  for (const [position, slug] of seed.categories.entries()) {
    const categoryId = categoryIds.get(slug);
    if (!categoryId) {
      throw new Error(`Unknown category seed: ${slug}`);
    }
    await tx.productCategory.upsert({
      where: {
        productId_categoryId: {
          productId: product.id,
          categoryId,
        },
      },
      update: { position },
      create: { productId: product.id, categoryId, position },
    });
  }

  for (const [position, slug] of seed.collections.entries()) {
    const collectionId = collectionIds.get(slug);
    if (!collectionId) {
      throw new Error(`Unknown collection seed: ${slug}`);
    }
    await tx.productCollection.upsert({
      where: {
        productId_collectionId: {
          productId: product.id,
          collectionId,
        },
      },
      update: { position },
      create: { productId: product.id, collectionId, position },
    });
  }

  for (const slug of seed.tags) {
    const tagId = tagIds.get(slug);
    if (!tagId) {
      throw new Error(`Unknown tag seed: ${slug}`);
    }
    await tx.productTag.upsert({
      where: {
        productId_tagId: {
          productId: product.id,
          tagId,
        },
      },
      update: {},
      create: { productId: product.id, tagId },
    });
  }

  return product;
}

async function seedService(tx: Prisma.TransactionClient, seed: ServiceSeed) {
  const service = await tx.service.upsert({
    where: { slug: seed.slug },
    update: {
      basePrice: money(seed.basePrice),
      currency: "USD",
      durationMinutes: seed.durationMinutes,
      bufferBeforeMinutes: seed.bufferBeforeMinutes,
      bufferAfterMinutes: seed.bufferAfterMinutes,
      depositAmount: seed.depositAmount ? money(seed.depositAmount) : null,
      isActive: true,
      isBookable: true,
      position: seed.position,
      imageUrl: seed.imageUrl,
    },
    create: {
      slug: seed.slug,
      basePrice: money(seed.basePrice),
      currency: "USD",
      durationMinutes: seed.durationMinutes,
      bufferBeforeMinutes: seed.bufferBeforeMinutes,
      bufferAfterMinutes: seed.bufferAfterMinutes,
      depositAmount: seed.depositAmount ? money(seed.depositAmount) : null,
      isActive: true,
      isBookable: true,
      position: seed.position,
      imageUrl: seed.imageUrl,
    },
  });

  for (const translation of seed.translations) {
    await tx.serviceTranslation.upsert({
      where: {
        serviceId_locale: {
          serviceId: service.id,
          locale: translation.locale,
        },
      },
      update: {
        name: translation.name,
        shortDescription: translation.shortDescription ?? null,
        description: translation.description ?? "",
      },
      create: {
        serviceId: service.id,
        locale: translation.locale,
        name: translation.name,
        shortDescription: translation.shortDescription ?? null,
        description: translation.description ?? "",
      },
    });
  }

  return service;
}

async function seedStoreSettings(
  tx: Prisma.TransactionClient,
  adminId: string,
) {
  const settings: Array<{
    key: string;
    category: string;
    value: Prisma.InputJsonValue;
    description: string;
    isPublic: boolean;
  }> = [
    {
      key: "brand",
      category: "branding",
      value: {
        name: "Luma Nail Atelier",
        tagline: {
          en: "Small details, beautifully considered.",
          zh: "细节之美，悉心呈现。",
        },
        primaryColor: "#6f574f",
        accentColor: "#d7b8af",
      },
      description: "Public brand identity and theme defaults.",
      isPublic: true,
    },
    {
      key: "contact",
      category: "business",
      value: {
        email: "hello@example.test",
        phone: "+1 555 010 1400",
        address: {
          line1: "1400 Atelier Lane",
          city: "Austin",
          region: "TX",
          postalCode: "78701",
          countryCode: "US",
        },
        socialLinks: {},
      },
      description: "Public business contact details.",
      isPublic: true,
    },
    {
      key: "localization",
      category: "localization",
      value: {
        defaultLocale: "en",
        supportedLocales: ["en", "zh"],
        currency: "USD",
        timezone: "America/Chicago",
      },
      description: "Locales, currency, and IANA business timezone.",
      isPublic: true,
    },
    {
      key: "appointmentRules",
      category: "appointments",
      value: {
        bookingLeadMinutes: 240,
        maximumAdvanceDays: 90,
        slotIntervalMinutes: 15,
        cancellationNoticeHours: 24,
        lateArrivalMinutes: 10,
        reminderHoursBefore: [24],
      },
      description: "Booking window, cancellation, and reminder rules.",
      isPublic: true,
    },
    {
      key: "appointmentDeposit",
      category: "appointments",
      value: {
        enabled: false,
        provider: "stripe",
        confirmOnlyAfterPayment: true,
        holdMinutes: 15,
      },
      description: "Feature-flagged appointment deposit behavior.",
      isPublic: false,
    },
    {
      key: "shippingMethods",
      category: "commerce",
      value: [
        {
          code: "standard",
          enabled: true,
          name: { en: "Standard shipping", zh: "标准配送" },
          price: "6.00",
          freeAbove: "75.00",
          estimatedBusinessDays: { min: 3, max: 6 },
        },
        {
          code: "pickup",
          enabled: true,
          name: { en: "Studio pickup", zh: "工作室自取" },
          price: "0.00",
        },
      ],
      description: "Server-authoritative shipping options.",
      isPublic: true,
    },
    {
      key: "featureFlags",
      category: "features",
      value: {
        appointments: true,
        customerAccounts: true,
        reviews: true,
        smsNotifications: false,
        wholesale: true,
      },
      description: "Template feature flags.",
      isPublic: true,
    },
    {
      key: "cloudinary",
      category: "integrations",
      value: {
        productFolder: "luma/products",
        contentFolder: "luma/content",
        allowedFormats: ["jpg", "jpeg", "png", "webp", "avif"],
        maxBytes: 10485760,
      },
      description:
        "Non-secret upload policy. Credentials remain in environment variables.",
      isPublic: false,
    },
  ];

  for (const setting of settings) {
    await tx.storeSetting.upsert({
      where: { key: setting.key },
      update: {
        category: setting.category,
        value: setting.value,
        description: setting.description,
        isPublic: setting.isPublic,
        updatedById: adminId,
      },
      create: {
        ...setting,
        updatedById: adminId,
      },
    });
  }
}

async function seedScheduling(
  tx: Prisma.TransactionClient,
  serviceIds: ReadonlyMap<string, string>,
) {
  const staff = await tx.staffMember.upsert({
    where: { email: "maya.artist@example.test" },
    update: {
      displayName: "Maya Chen",
      bio: "Detail-focused nail artist specializing in softly layered color and natural shaping.",
      isActive: true,
      position: 10,
    },
    create: {
      displayName: "Maya Chen",
      email: "maya.artist@example.test",
      bio: "Detail-focused nail artist specializing in softly layered color and natural shaping.",
      isActive: true,
      position: 10,
    },
  });

  for (const serviceId of serviceIds.values()) {
    await tx.staffService.upsert({
      where: { staffId_serviceId: { staffId: staff.id, serviceId } },
      update: {},
      create: { staffId: staff.id, serviceId },
    });
  }

  const openDays = [
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ];

  for (const dayOfWeek of openDays) {
    const startMinute = dayOfWeek === DayOfWeek.SATURDAY ? 600 : 570;
    const endMinute = dayOfWeek === DayOfWeek.SATURDAY ? 960 : 1080;

    await tx.businessHours.upsert({
      where: {
        dayOfWeek_startMinute_endMinute: {
          dayOfWeek,
          startMinute,
          endMinute,
        },
      },
      update: { isOpen: true, label: "Studio hours" },
      create: {
        dayOfWeek,
        startMinute,
        endMinute,
        isOpen: true,
        label: "Studio hours",
      },
    });

    await tx.staffAvailability.upsert({
      where: {
        staffId_dayOfWeek_startMinute_endMinute: {
          staffId: staff.id,
          dayOfWeek,
          startMinute,
          endMinute,
        },
      },
      update: { isAvailable: true },
      create: {
        staffId: staff.id,
        dayOfWeek,
        startMinute,
        endMinute,
        isAvailable: true,
      },
    });
  }

  await tx.blockedTime.upsert({
    where: { id: "seed-holiday-2030-new-year" },
    update: {
      type: BlockedTimeType.HOLIDAY,
      startsAt: new Date("2030-01-01T06:00:00.000Z"),
      endsAt: new Date("2030-01-02T06:00:00.000Z"),
      reason: "New Year's Day",
      isAllDay: true,
    },
    create: {
      id: "seed-holiday-2030-new-year",
      type: BlockedTimeType.HOLIDAY,
      startsAt: new Date("2030-01-01T06:00:00.000Z"),
      endsAt: new Date("2030-01-02T06:00:00.000Z"),
      reason: "New Year's Day",
      isAllDay: true,
    },
  });

  return staff;
}

async function seedOptionalDemoData(
  tx: Prisma.TransactionClient,
  adminId: string,
  productIds: ReadonlyMap<string, string>,
  serviceIds: ReadonlyMap<string, string>,
  staffId: string,
) {
  const customer = await tx.user.upsert({
    where: { email: "demo.customer@example.test" },
    update: {
      name: "Avery Lin",
      preferredLocale: "en",
      status: UserStatus.ACTIVE,
    },
    create: {
      name: "Avery Lin",
      email: "demo.customer@example.test",
      emailVerified: new Date("2026-05-01T14:00:00.000Z"),
      preferredLocale: "en",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });

  await tx.address.upsert({
    where: {
      userId_label: {
        userId: customer.id,
        label: "Home",
      },
    },
    update: {
      recipientName: "Avery Lin",
      line1: "140 Example Street",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      countryCode: "US",
      phone: "+1 555 010 0140",
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
    create: {
      userId: customer.id,
      label: "Home",
      recipientName: "Avery Lin",
      line1: "140 Example Street",
      city: "Austin",
      region: "TX",
      postalCode: "78701",
      countryCode: "US",
      phone: "+1 555 010 0140",
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
  });

  const productId = productIds.get("moonlit-pearl-almond-set");
  if (!productId) {
    throw new Error("Demo product was not seeded.");
  }
  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { sku: "LUMA-MPA-M" },
  });
  const image = await tx.productImage.findUniqueOrThrow({
    where: { productId_position: { productId, position: 0 } },
  });

  const cart = await tx.cart.upsert({
    where: { id: "seed-demo-converted-cart" },
    update: {
      userId: customer.id,
      status: CartStatus.CONVERTED,
      currency: "USD",
      expiresAt: null,
    },
    create: {
      id: "seed-demo-converted-cart",
      userId: customer.id,
      status: CartStatus.CONVERTED,
      currency: "USD",
    },
  });

  await tx.cartItem.upsert({
    where: {
      cartId_lineKey: {
        cartId: cart.id,
        lineKey: "LUMA-MPA-M:standard",
      },
    },
    update: {
      variantId: variant.id,
      quantity: 1,
      unitPriceSnapshot: money("38.00"),
    },
    create: {
      cartId: cart.id,
      variantId: variant.id,
      lineKey: "LUMA-MPA-M:standard",
      quantity: 1,
      unitPriceSnapshot: money("38.00"),
    },
  });

  const shippingAddress = {
    recipientName: "Avery Lin",
    line1: "140 Example Street",
    city: "Austin",
    region: "TX",
    postalCode: "78701",
    countryCode: "US",
    phone: "+1 555 010 0140",
  };

  const order = await tx.order.upsert({
    where: { orderNumber: "DEMO-2030-0001" },
    update: {
      userId: customer.id,
      cartId: cart.id,
      status: OrderStatus.SHIPPED,
      paymentStatus: PaymentStatus.SUCCEEDED,
      locale: "en",
      currency: "USD",
      customerNameSnapshot: "Avery Lin",
      emailSnapshot: "demo.customer@example.test",
      emailNormalized: "demo.customer@example.test",
      phoneSnapshot: "+1 555 010 0140",
      phoneNormalized: "+15550100140",
      shippingAddressSnapshot: shippingAddress,
      billingAddressSnapshot: shippingAddress,
      subtotal: money("38.00"),
      discountTotal: money("0.00"),
      shippingTotal: money("6.00"),
      taxTotal: money("3.63"),
      grandTotal: money("47.63"),
      shippingMethodSnapshot: {
        code: "standard",
        name: "Standard shipping",
        price: "6.00",
      },
      placedAt: new Date("2030-06-01T16:30:00.000Z"),
    },
    create: {
      orderNumber: "DEMO-2030-0001",
      userId: customer.id,
      cartId: cart.id,
      status: OrderStatus.SHIPPED,
      paymentStatus: PaymentStatus.SUCCEEDED,
      locale: "en",
      currency: "USD",
      customerNameSnapshot: "Avery Lin",
      emailSnapshot: "demo.customer@example.test",
      emailNormalized: "demo.customer@example.test",
      phoneSnapshot: "+1 555 010 0140",
      phoneNormalized: "+15550100140",
      shippingAddressSnapshot: shippingAddress,
      billingAddressSnapshot: shippingAddress,
      subtotal: money("38.00"),
      discountTotal: money("0.00"),
      shippingTotal: money("6.00"),
      taxTotal: money("3.63"),
      grandTotal: money("47.63"),
      shippingMethodSnapshot: {
        code: "standard",
        name: "Standard shipping",
        price: "6.00",
      },
      placedAt: new Date("2030-06-01T16:30:00.000Z"),
    },
  });

  const orderItem = await tx.orderItem.upsert({
    where: {
      orderId_lineNumber: {
        orderId: order.id,
        lineNumber: 1,
      },
    },
    update: {
      productId,
      variantId: variant.id,
      productNameSnapshot: "Moonlit Pearl Almond Set",
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      imageUrlSnapshot: image.url,
      unitPrice: money("38.00"),
      quantity: 1,
      subtotal: money("38.00"),
      discountTotal: money("0.00"),
      taxTotal: money("3.63"),
      total: money("41.63"),
      productSnapshot: {
        slug: "moonlit-pearl-almond-set",
        options: variant.optionValues,
      },
    },
    create: {
      orderId: order.id,
      lineNumber: 1,
      productId,
      variantId: variant.id,
      productNameSnapshot: "Moonlit Pearl Almond Set",
      variantNameSnapshot: variant.name,
      skuSnapshot: variant.sku,
      imageUrlSnapshot: image.url,
      unitPrice: money("38.00"),
      quantity: 1,
      subtotal: money("38.00"),
      discountTotal: money("0.00"),
      taxTotal: money("3.63"),
      total: money("41.63"),
      productSnapshot: {
        slug: "moonlit-pearl-almond-set",
        options: variant.optionValues,
      },
    },
  });

  await tx.payment.upsert({
    where: {
      provider_providerPaymentId: {
        provider: PaymentProvider.STRIPE,
        providerPaymentId: "seed_pi_demo_20300001",
      },
    },
    update: {
      orderId: order.id,
      status: PaymentStatus.SUCCEEDED,
      amount: money("47.63"),
      refundedAmount: money("0.00"),
      currency: "USD",
      paymentMethodType: "card",
      providerMetadata: { seeded: true, livemode: false },
      processedAt: new Date("2030-06-01T16:31:00.000Z"),
    },
    create: {
      orderId: order.id,
      provider: PaymentProvider.STRIPE,
      providerPaymentId: "seed_pi_demo_20300001",
      idempotencyKey: "seed-demo-order-payment-20300001",
      status: PaymentStatus.SUCCEEDED,
      amount: money("47.63"),
      refundedAmount: money("0.00"),
      currency: "USD",
      paymentMethodType: "card",
      providerMetadata: { seeded: true, livemode: false },
      processedAt: new Date("2030-06-01T16:31:00.000Z"),
    },
  });

  await tx.shipment.upsert({
    where: { id: "seed-demo-shipment-20300001" },
    update: {
      orderId: order.id,
      status: ShipmentStatus.IN_TRANSIT,
      carrier: "Demo Carrier",
      service: "Ground",
      trackingNumber: "DEMO20300001",
      trackingUrl: null,
      shippingAddressSnapshot: shippingAddress,
      shippedAt: new Date("2030-06-03T15:00:00.000Z"),
    },
    create: {
      id: "seed-demo-shipment-20300001",
      orderId: order.id,
      status: ShipmentStatus.IN_TRANSIT,
      carrier: "Demo Carrier",
      service: "Ground",
      trackingNumber: "DEMO20300001",
      shippingAddressSnapshot: shippingAddress,
      shippedAt: new Date("2030-06-03T15:00:00.000Z"),
    },
  });

  await tx.review.upsert({
    where: { orderItemId: orderItem.id },
    update: {
      productId,
      userId: customer.id,
      authorName: "Avery L.",
      authorEmailHash: hashToken("demo.customer@example.test"),
      rating: 5,
      title: "Subtle and easy to wear",
      body: "The pearl finish catches the light beautifully, and the sizing guide made application simple.",
      status: ReviewStatus.APPROVED,
      isVerified: true,
      moderatedById: adminId,
      moderatedAt: new Date("2030-06-10T15:00:00.000Z"),
    },
    create: {
      productId,
      userId: customer.id,
      orderItemId: orderItem.id,
      authorName: "Avery L.",
      authorEmailHash: hashToken("demo.customer@example.test"),
      rating: 5,
      title: "Subtle and easy to wear",
      body: "The pearl finish catches the light beautifully, and the sizing guide made application simple.",
      status: ReviewStatus.APPROVED,
      isVerified: true,
      moderatedById: adminId,
      moderatedAt: new Date("2030-06-10T15:00:00.000Z"),
    },
  });

  const wishlist = await tx.wishlist.upsert({
    where: { userId: customer.id },
    update: {},
    create: { userId: customer.id },
  });
  const wishlistProductId = productIds.get("jade-mist-sculpted-set");
  if (!wishlistProductId) {
    throw new Error("Demo wishlist product was not seeded.");
  }
  await tx.wishlistItem.upsert({
    where: {
      wishlistId_selectionKey: {
        wishlistId: wishlist.id,
        selectionKey: `product:${wishlistProductId}`,
      },
    },
    update: { productId: wishlistProductId, variantId: null },
    create: {
      wishlistId: wishlist.id,
      productId: wishlistProductId,
      selectionKey: `product:${wishlistProductId}`,
    },
  });

  const serviceId = serviceIds.get("signature-gel-manicure");
  if (!serviceId) {
    throw new Error("Demo appointment service was not seeded.");
  }

  const appointment = await tx.appointment.upsert({
    where: { confirmationNumber: "DEMO-APT-2030-0001" },
    update: {
      userId: customer.id,
      serviceId,
      staffId,
      status: AppointmentStatus.CONFIRMED,
      locale: "en",
      timezone: "America/Chicago",
      customerNameSnapshot: "Avery Lin",
      emailSnapshot: "demo.customer@example.test",
      emailNormalized: "demo.customer@example.test",
      phoneSnapshot: "+1 555 010 0140",
      phoneNormalized: "+15550100140",
      preferredContactMethod: ContactMethod.EMAIL,
      messagingConsent: true,
      serviceNameSnapshot: "Signature Gel Manicure",
      priceSnapshot: money("55.00"),
      depositAmountSnapshot: money("0.00"),
      currency: "USD",
      durationMinutes: 60,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      startAt: new Date("2030-06-18T15:00:00.000Z"),
      endAt: new Date("2030-06-18T16:00:00.000Z"),
      reservedStartAt: new Date("2030-06-18T14:50:00.000Z"),
      reservedEndAt: new Date("2030-06-18T16:10:00.000Z"),
      locationSnapshot: {
        name: "Luma Nail Atelier",
        line1: "1400 Atelier Lane",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        countryCode: "US",
      },
      customerNotes: "Prefers a sheer neutral shade.",
      nextReminderAt: new Date("2030-06-17T15:00:00.000Z"),
    },
    create: {
      confirmationNumber: "DEMO-APT-2030-0001",
      userId: customer.id,
      serviceId,
      staffId,
      status: AppointmentStatus.CONFIRMED,
      locale: "en",
      timezone: "America/Chicago",
      customerNameSnapshot: "Avery Lin",
      emailSnapshot: "demo.customer@example.test",
      emailNormalized: "demo.customer@example.test",
      phoneSnapshot: "+1 555 010 0140",
      phoneNormalized: "+15550100140",
      preferredContactMethod: ContactMethod.EMAIL,
      messagingConsent: true,
      serviceNameSnapshot: "Signature Gel Manicure",
      priceSnapshot: money("55.00"),
      depositAmountSnapshot: money("0.00"),
      currency: "USD",
      durationMinutes: 60,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      startAt: new Date("2030-06-18T15:00:00.000Z"),
      endAt: new Date("2030-06-18T16:00:00.000Z"),
      reservedStartAt: new Date("2030-06-18T14:50:00.000Z"),
      reservedEndAt: new Date("2030-06-18T16:10:00.000Z"),
      locationSnapshot: {
        name: "Luma Nail Atelier",
        line1: "1400 Atelier Lane",
        city: "Austin",
        region: "TX",
        postalCode: "78701",
        countryCode: "US",
      },
      customerNotes: "Prefers a sheer neutral shade.",
      nextReminderAt: new Date("2030-06-17T15:00:00.000Z"),
    },
  });

  await tx.appointmentStatusHistory.upsert({
    where: {
      appointmentId_sequence: {
        appointmentId: appointment.id,
        sequence: 1,
      },
    },
    update: {
      fromStatus: null,
      toStatus: AppointmentStatus.CONFIRMED,
      note: "Seeded demonstration appointment.",
      changedById: adminId,
    },
    create: {
      appointmentId: appointment.id,
      sequence: 1,
      toStatus: AppointmentStatus.CONFIRMED,
      note: "Seeded demonstration appointment.",
      changedById: adminId,
      createdAt: new Date("2030-05-20T15:00:00.000Z"),
    },
  });

  await tx.appointmentManagementToken.upsert({
    where: { tokenHash: hashToken("expired-seed-demo-management-token") },
    update: {
      appointmentId: appointment.id,
      purpose: AppointmentTokenPurpose.MANAGE,
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      revokedAt: new Date("2025-01-01T00:00:00.000Z"),
    },
    create: {
      appointmentId: appointment.id,
      tokenHash: hashToken("expired-seed-demo-management-token"),
      purpose: AppointmentTokenPurpose.MANAGE,
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      revokedAt: new Date("2025-01-01T00:00:00.000Z"),
    },
  });

  await tx.newsletterSubscription.upsert({
    where: { emailNormalized: "demo.customer@example.test" },
    update: {
      userId: customer.id,
      email: "demo.customer@example.test",
      locale: "en",
      status: NewsletterStatus.UNSUBSCRIBED,
      source: "seed",
      unsubscribedAt: new Date("2030-05-01T12:00:00.000Z"),
    },
    create: {
      userId: customer.id,
      email: "demo.customer@example.test",
      emailNormalized: "demo.customer@example.test",
      locale: "en",
      status: NewsletterStatus.UNSUBSCRIBED,
      source: "seed",
      consentText: "Demonstration record; no messages may be sent.",
      consentedAt: new Date("2030-04-01T12:00:00.000Z"),
      unsubscribedAt: new Date("2030-05-01T12:00:00.000Z"),
    },
  });

  await tx.wholesaleApplication.upsert({
    where: { id: "seed-demo-wholesale-application" },
    update: {
      userId: customer.id,
      businessName: "Example Beauty Studio",
      contactName: "Avery Lin",
      email: "wholesale.demo@example.test",
      emailNormalized: "wholesale.demo@example.test",
      countryCode: "US",
      estimatedVolume: "25-50 sets per quarter",
      message: "Demonstration application for dashboard previews.",
      metadata: { seeded: true },
      status: WholesaleApplicationStatus.PENDING,
    },
    create: {
      id: "seed-demo-wholesale-application",
      userId: customer.id,
      businessName: "Example Beauty Studio",
      contactName: "Avery Lin",
      email: "wholesale.demo@example.test",
      emailNormalized: "wholesale.demo@example.test",
      countryCode: "US",
      estimatedVolume: "25-50 sets per quarter",
      message: "Demonstration application for dashboard previews.",
      metadata: { seeded: true },
      status: WholesaleApplicationStatus.PENDING,
    },
  });

  await tx.webhookEvent.upsert({
    where: {
      provider_externalEventId: {
        provider: "stripe",
        externalEventId: "evt_seed_demo_20300001",
      },
    },
    update: {
      eventType: "checkout.session.completed",
      objectId: "cs_seed_demo_20300001",
      payloadHash: hashToken("seed-demo-webhook-payload"),
      status: WebhookStatus.IGNORED,
      result: { seeded: true, reason: "Demonstration event" },
      processedAt: new Date("2030-06-01T16:31:05.000Z"),
    },
    create: {
      provider: "stripe",
      externalEventId: "evt_seed_demo_20300001",
      eventType: "checkout.session.completed",
      objectId: "cs_seed_demo_20300001",
      payloadHash: hashToken("seed-demo-webhook-payload"),
      status: WebhookStatus.IGNORED,
      result: { seeded: true, reason: "Demonstration event" },
      receivedAt: new Date("2030-06-01T16:31:05.000Z"),
      processedAt: new Date("2030-06-01T16:31:05.000Z"),
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const rotatePassword = process.env.SEED_ADMIN_ROTATE_PASSWORD === "true";
  const includeDemoData = process.env.SEED_DEMO_DATA === "true";

  await prisma.$transaction(
    async (tx) => {
      const existingAdmin = await tx.user.findUnique({
        where: { email: adminEmail },
        select: { role: true },
      });
      const adminRole =
        existingAdmin?.role === UserRole.SUPER_ADMIN
          ? UserRole.SUPER_ADMIN
          : UserRole.ADMIN;

      const admin = await tx.user.upsert({
        where: { email: adminEmail },
        update: {
          name: adminName,
          role: adminRole,
          status: UserStatus.ACTIVE,
          ...(rotatePassword ? { passwordHash } : {}),
        },
        create: {
          name: adminName,
          email: adminEmail,
          emailVerified: new Date(),
          passwordHash,
          preferredLocale: "en",
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      const categoryIds = new Map<string, string>();
      for (const seed of categorySeeds) {
        const category = await seedCategory(tx, seed);
        categoryIds.set(seed.slug, category.id);
      }

      const collectionIds = new Map<string, string>();
      for (const seed of collectionSeeds) {
        const collection = await seedCollection(tx, seed);
        collectionIds.set(seed.slug, collection.id);
      }

      const tagIds = new Map<string, string>();
      for (const seed of tagSeeds) {
        const tag = await seedTag(tx, seed);
        tagIds.set(seed.slug, tag.id);
      }

      const productIds = new Map<string, string>();
      for (const seed of productSeeds) {
        const product = await seedProduct(
          tx,
          seed,
          categoryIds,
          collectionIds,
          tagIds,
        );
        productIds.set(seed.slug, product.id);
      }

      const serviceIds = new Map<string, string>();
      for (const seed of serviceSeeds) {
        const service = await seedService(tx, seed);
        serviceIds.set(seed.slug, service.id);
      }

      const staff = await seedScheduling(tx, serviceIds);
      await seedStoreSettings(tx, admin.id);

      const discount = await tx.discount.upsert({
        where: { code: "WELCOME10" },
        update: {
          name: "Welcome 10% (demo)",
          description:
            "Inactive example discount. Review settings before enabling.",
          type: DiscountType.PERCENTAGE,
          percentage: money("10.00"),
          amount: null,
          currency: "USD",
          minimumSubtotal: money("35.00"),
          maximumDiscount: money("20.00"),
          usageLimit: 500,
          usageLimitPerEmail: 1,
          isActive: false,
        },
        create: {
          code: "WELCOME10",
          name: "Welcome 10% (demo)",
          description:
            "Inactive example discount. Review settings before enabling.",
          type: DiscountType.PERCENTAGE,
          percentage: money("10.00"),
          currency: "USD",
          minimumSubtotal: money("35.00"),
          maximumDiscount: money("20.00"),
          usageLimit: 500,
          usageLimitPerEmail: 1,
          isActive: false,
        },
      });

      const pressOnCategoryId = categoryIds.get("press-on-sets");
      if (!pressOnCategoryId) {
        throw new Error("Press-on category was not seeded.");
      }
      await tx.discountCategory.upsert({
        where: {
          discountId_categoryId: {
            discountId: discount.id,
            categoryId: pressOnCategoryId,
          },
        },
        update: {},
        create: {
          discountId: discount.id,
          categoryId: pressOnCategoryId,
        },
      });

      await tx.auditLog.upsert({
        where: { id: "seed-initial-catalog-audit" },
        update: {
          actorId: admin.id,
          metadata: {
            source: "prisma-seed",
            demoDataIncluded: includeDemoData,
          },
        },
        create: {
          id: "seed-initial-catalog-audit",
          actorId: admin.id,
          action: "SEED_CATALOG",
          entityType: "Store",
          entityId: "default",
          metadata: {
            source: "prisma-seed",
            demoDataIncluded: includeDemoData,
          },
        },
      });

      if (includeDemoData) {
        await seedOptionalDemoData(
          tx,
          admin.id,
          productIds,
          serviceIds,
          staff.id,
        );
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 120_000,
    },
  );

  console.info(
    `Seed completed. Demo transactional data: ${includeDemoData ? "included" : "skipped"}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

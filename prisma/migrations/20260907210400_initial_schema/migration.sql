-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRESS_ON_SET', 'SUPPLY', 'ACCESSORY', 'GIFT_CARD');

-- CreateEnum
CREATE TYPE "InventoryAdjustmentType" AS ENUM ('RECEIPT', 'RESERVATION', 'RELEASE', 'SALE', 'RETURN', 'CORRECTION');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'LABEL_CREATED', 'IN_TRANSIT', 'DELIVERED', 'LOST', 'RETURNED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "BlockedTimeType" AS ENUM ('BREAK', 'HOLIDAY', 'CLOSURE', 'PERSONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'SMS', 'PHONE');

-- CreateEnum
CREATE TYPE "AppointmentTokenPurpose" AS ENUM ('MANAGE', 'CANCEL', 'RESCHEDULE');

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "WholesaleApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMPTZ(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "preferredLocale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL DEFAULT 'Address',
    "recipientName" TEXT NOT NULL,
    "company" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "postalCode" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL,
    "phone" TEXT,
    "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "type" "ProductType" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "basePrice" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "costPrice" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "taxCategory" TEXT,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
    "isCustomizable" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "publishedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTranslation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "altText" TEXT NOT NULL,
    "altTextZh" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "bytes" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "optionValues" JSONB NOT NULL,
    "size" TEXT,
    "shape" TEXT,
    "length" TEXT,
    "color" TEXT,
    "finish" TEXT,
    "setQuantity" INTEGER,
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "costPrice" DECIMAL(12,2),
    "barcode" TEXT,
    "weightGrams" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionTranslation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "CollectionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCollection" (
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCollection_pkey" PRIMARY KEY ("productId","collectionId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagTranslation" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TagTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "type" "InventoryAdjustmentType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionTokenHash" CHAR(64),
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "discountId" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "lineKey" VARCHAR(160) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "customization" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionTokenHash" CHAR(64),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "wishlistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "selectionKey" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" VARCHAR(40) NOT NULL,
    "userId" TEXT,
    "cartId" TEXT,
    "discountId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "customerNameSnapshot" TEXT NOT NULL,
    "emailSnapshot" TEXT,
    "emailNormalized" TEXT,
    "phoneSnapshot" TEXT,
    "phoneNormalized" TEXT,
    "shippingAddressSnapshot" JSONB,
    "billingAddressSnapshot" JSONB,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "discountCodeSnapshot" TEXT,
    "shippingMethodSnapshot" JSONB,
    "customerNote" TEXT,
    "internalNote" TEXT,
    "placedAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "variantNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "imageUrlSnapshot" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "customization" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "appointmentId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "providerPaymentId" TEXT,
    "idempotencyKey" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "paymentMethodType" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "providerMetadata" JSONB,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "carrier" TEXT,
    "service" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "shippingAddressSnapshot" JSONB NOT NULL,
    "labelMetadata" JSONB,
    "shippedAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "percentage" DECIMAL(5,2),
    "amount" DECIMAL(12,2),
    "currency" CHAR(3),
    "minimumSubtotal" DECIMAL(12,2),
    "maximumDiscount" DECIMAL(12,2),
    "usageLimit" INTEGER,
    "usageLimitPerEmail" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountProduct" (
    "discountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "DiscountProduct_pkey" PRIMARY KEY ("discountId","productId")
);

-- CreateTable
CREATE TABLE "DiscountCategory" (
    "discountId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "DiscountCategory_pkey" PRIMARY KEY ("discountId","categoryId")
);

-- CreateTable
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "emailNormalized" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "redeemedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "orderItemId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorEmailHash" CHAR(64),
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMPTZ(3),
    "adminResponse" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "durationMinutes" INTEGER NOT NULL,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBookable" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTranslation" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,

    CONSTRAINT "ServiceTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffService" (
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceOverride" DECIMAL(12,2),
    "durationOverrideMinutes" INTEGER,

    CONSTRAINT "StaffService_pkey" PRIMARY KEY ("staffId","serviceId")
);

-- CreateTable
CREATE TABLE "StaffAvailability" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "validFrom" DATE,
    "validUntil" DATE,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedTime" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "type" "BlockedTimeType" NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BlockedTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "confirmationNumber" VARCHAR(40) NOT NULL,
    "userId" TEXT,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "createdById" TEXT,
    "rescheduledFromId" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL,
    "customerNameSnapshot" TEXT NOT NULL,
    "emailSnapshot" TEXT,
    "emailNormalized" TEXT,
    "phoneSnapshot" TEXT,
    "phoneNormalized" TEXT,
    "preferredContactMethod" "ContactMethod" NOT NULL,
    "messagingConsent" BOOLEAN NOT NULL DEFAULT false,
    "serviceNameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "depositAmountSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "durationMinutes" INTEGER NOT NULL,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "reservedStartAt" TIMESTAMPTZ(3) NOT NULL,
    "reservedEndAt" TIMESTAMPTZ(3) NOT NULL,
    "locationSnapshot" JSONB NOT NULL,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "cancellationReason" TEXT,
    "canceledAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "holdExpiresAt" TIMESTAMPTZ(3),
    "nextReminderAt" TIMESTAMPTZ(3),
    "reminderSentAt" TIMESTAMPTZ(3),
    "reminderAttempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentStatusHistory" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromStatus" "AppointmentStatus",
    "toStatus" "AppointmentStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentManagementToken" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "purpose" "AppointmentTokenPurpose" NOT NULL DEFAULT 'MANAGE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentManagementToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "consentText" TEXT,
    "consentedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "unsubscribedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WholesaleApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "businessType" TEXT,
    "taxId" TEXT,
    "countryCode" CHAR(2) NOT NULL,
    "estimatedVolume" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "status" "WholesaleApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WholesaleApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSetting" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddressHash" CHAR(64),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "externalEventId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "objectId" TEXT,
    "payloadHash" CHAR(64) NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PROCESSING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "result" JSONB,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE INDEX "VerificationToken_expires_idx" ON "VerificationToken"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Address_userId_isDefaultShipping_idx" ON "Address"("userId", "isDefaultShipping");

-- CreateIndex
CREATE INDEX "Address_userId_isDefaultBilling_idx" ON "Address"("userId", "isDefaultBilling");

-- CreateIndex
CREATE UNIQUE INDEX "Address_userId_label_key" ON "Address"("userId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_publishedAt_idx" ON "Product"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Product_type_status_idx" ON "Product"("type", "status");

-- CreateIndex
CREATE INDEX "Product_isFeatured_status_idx" ON "Product"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "ProductTranslation_locale_name_idx" ON "ProductTranslation"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "ProductImage"("publicId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_isPrimary_idx" ON "ProductImage"("productId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_barcode_key" ON "ProductVariant"("barcode");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_position_key" ON "ProductVariant"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_position_idx" ON "Category"("parentId", "position");

-- CreateIndex
CREATE INDEX "Category_isActive_position_idx" ON "Category"("isActive", "position");

-- CreateIndex
CREATE INDEX "CategoryTranslation_locale_name_idx" ON "CategoryTranslation"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_position_idx" ON "ProductCategory"("categoryId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_isActive_position_idx" ON "Collection"("isActive", "position");

-- CreateIndex
CREATE INDEX "Collection_isFeatured_isActive_idx" ON "Collection"("isFeatured", "isActive");

-- CreateIndex
CREATE INDEX "CollectionTranslation_locale_name_idx" ON "CollectionTranslation"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionTranslation_collectionId_locale_key" ON "CollectionTranslation"("collectionId", "locale");

-- CreateIndex
CREATE INDEX "ProductCollection_collectionId_position_idx" ON "ProductCollection"("collectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "TagTranslation_locale_name_idx" ON "TagTranslation"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TagTranslation_tagId_locale_key" ON "TagTranslation"("tagId", "locale");

-- CreateIndex
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_variantId_key" ON "Inventory"("variantId");

-- CreateIndex
CREATE INDEX "Inventory_quantityOnHand_quantityReserved_idx" ON "Inventory"("quantityOnHand", "quantityReserved");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_inventoryId_createdAt_idx" ON "InventoryAdjustment"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_referenceType_referenceId_idx" ON "InventoryAdjustment"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_createdById_idx" ON "InventoryAdjustment"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sessionTokenHash_key" ON "Cart"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");

-- CreateIndex
CREATE INDEX "Cart_status_expiresAt_idx" ON "Cart"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Cart_discountId_idx" ON "Cart"("discountId");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_lineKey_key" ON "CartItem"("cartId", "lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_key" ON "Wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_sessionTokenHash_key" ON "Wishlist"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "Wishlist_expiresAt_idx" ON "Wishlist"("expiresAt");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "WishlistItem"("productId");

-- CreateIndex
CREATE INDEX "WishlistItem_variantId_idx" ON "WishlistItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_wishlistId_selectionKey_key" ON "WishlistItem"("wishlistId", "selectionKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_cartId_key" ON "Order"("cartId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_emailNormalized_orderNumber_idx" ON "Order"("emailNormalized", "orderNumber");

-- CreateIndex
CREATE INDEX "Order_phoneNormalized_orderNumber_idx" ON "Order"("phoneNormalized", "orderNumber");

-- CreateIndex
CREATE INDEX "Order_discountId_idx" ON "Order"("discountId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE INDEX "OrderItem_skuSnapshot_idx" ON "OrderItem"("skuSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_lineNumber_key" ON "OrderItem"("orderId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_appointmentId_status_idx" ON "Payment"("appointmentId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_status_idx" ON "Shipment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_carrier_trackingNumber_key" ON "Shipment"("carrier", "trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_code_key" ON "Discount"("code");

-- CreateIndex
CREATE INDEX "Discount_isActive_startsAt_endsAt_idx" ON "Discount"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "DiscountProduct_productId_idx" ON "DiscountProduct"("productId");

-- CreateIndex
CREATE INDEX "DiscountCategory_categoryId_idx" ON "DiscountCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountRedemption_orderId_key" ON "DiscountRedemption"("orderId");

-- CreateIndex
CREATE INDEX "DiscountRedemption_discountId_redeemedAt_idx" ON "DiscountRedemption"("discountId", "redeemedAt");

-- CreateIndex
CREATE INDEX "DiscountRedemption_userId_redeemedAt_idx" ON "DiscountRedemption"("userId", "redeemedAt");

-- CreateIndex
CREATE INDEX "DiscountRedemption_emailNormalized_redeemedAt_idx" ON "DiscountRedemption"("emailNormalized", "redeemedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_createdAt_idx" ON "Review"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_moderatedById_idx" ON "Review"("moderatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_isActive_isBookable_position_idx" ON "Service"("isActive", "isBookable", "position");

-- CreateIndex
CREATE INDEX "ServiceTranslation_locale_name_idx" ON "ServiceTranslation"("locale", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTranslation_serviceId_locale_key" ON "ServiceTranslation"("serviceId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_email_key" ON "StaffMember"("email");

-- CreateIndex
CREATE INDEX "StaffMember_isActive_position_idx" ON "StaffMember"("isActive", "position");

-- CreateIndex
CREATE INDEX "StaffService_serviceId_idx" ON "StaffService"("serviceId");

-- CreateIndex
CREATE INDEX "StaffAvailability_staffId_dayOfWeek_isAvailable_idx" ON "StaffAvailability"("staffId", "dayOfWeek", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAvailability_staffId_dayOfWeek_startMinute_endMinute_key" ON "StaffAvailability"("staffId", "dayOfWeek", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "BusinessHours_dayOfWeek_isOpen_idx" ON "BusinessHours"("dayOfWeek", "isOpen");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_dayOfWeek_startMinute_endMinute_key" ON "BusinessHours"("dayOfWeek", "startMinute", "endMinute");

-- CreateIndex
CREATE INDEX "BlockedTime_staffId_startsAt_endsAt_idx" ON "BlockedTime"("staffId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "BlockedTime_type_startsAt_idx" ON "BlockedTime"("type", "startsAt");

-- CreateIndex
CREATE INDEX "BlockedTime_createdById_idx" ON "BlockedTime"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_confirmationNumber_key" ON "Appointment"("confirmationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_rescheduledFromId_key" ON "Appointment"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Appointment_staffId_reservedStartAt_reservedEndAt_status_idx" ON "Appointment"("staffId", "reservedStartAt", "reservedEndAt", "status");

-- CreateIndex
CREATE INDEX "Appointment_status_startAt_idx" ON "Appointment"("status", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_userId_startAt_idx" ON "Appointment"("userId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_emailNormalized_confirmationNumber_idx" ON "Appointment"("emailNormalized", "confirmationNumber");

-- CreateIndex
CREATE INDEX "Appointment_phoneNormalized_confirmationNumber_idx" ON "Appointment"("phoneNormalized", "confirmationNumber");

-- CreateIndex
CREATE INDEX "Appointment_nextReminderAt_status_idx" ON "Appointment"("nextReminderAt", "status");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_startAt_idx" ON "Appointment"("serviceId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_createdById_idx" ON "Appointment"("createdById");

-- CreateIndex
CREATE INDEX "AppointmentStatusHistory_appointmentId_createdAt_idx" ON "AppointmentStatusHistory"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentStatusHistory_changedById_idx" ON "AppointmentStatusHistory"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentStatusHistory_appointmentId_sequence_key" ON "AppointmentStatusHistory"("appointmentId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentManagementToken_tokenHash_key" ON "AppointmentManagementToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AppointmentManagementToken_appointmentId_expiresAt_idx" ON "AppointmentManagementToken"("appointmentId", "expiresAt");

-- CreateIndex
CREATE INDEX "AppointmentManagementToken_expiresAt_revokedAt_idx" ON "AppointmentManagementToken"("expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscription_userId_key" ON "NewsletterSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscription_emailNormalized_key" ON "NewsletterSubscription"("emailNormalized");

-- CreateIndex
CREATE INDEX "NewsletterSubscription_status_createdAt_idx" ON "NewsletterSubscription"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WholesaleApplication_status_createdAt_idx" ON "WholesaleApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WholesaleApplication_emailNormalized_createdAt_idx" ON "WholesaleApplication"("emailNormalized", "createdAt");

-- CreateIndex
CREATE INDEX "WholesaleApplication_userId_idx" ON "WholesaleApplication"("userId");

-- CreateIndex
CREATE INDEX "WholesaleApplication_reviewedById_idx" ON "WholesaleApplication"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSetting_key_key" ON "StoreSetting"("key");

-- CreateIndex
CREATE INDEX "StoreSetting_category_isPublic_idx" ON "StoreSetting"("category", "isPublic");

-- CreateIndex
CREATE INDEX "StoreSetting_updatedById_idx" ON "StoreSetting"("updatedById");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_objectId_idx" ON "WebhookEvent"("objectId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_receivedAt_idx" ON "WebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionTranslation" ADD CONSTRAINT "CollectionTranslation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCollection" ADD CONSTRAINT "ProductCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagTranslation" ADD CONSTRAINT "TagTranslation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountProduct" ADD CONSTRAINT "DiscountProduct_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountProduct" ADD CONSTRAINT "DiscountProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCategory" ADD CONSTRAINT "DiscountCategory_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCategory" ADD CONSTRAINT "DiscountCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTranslation" ADD CONSTRAINT "ServiceTranslation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedTime" ADD CONSTRAINT "BlockedTime_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedTime" ADD CONSTRAINT "BlockedTime_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentManagementToken" ADD CONSTRAINT "AppointmentManagementToken_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSubscription" ADD CONSTRAINT "NewsletterSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleApplication" ADD CONSTRAINT "WholesaleApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WholesaleApplication" ADD CONSTRAINT "WholesaleApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSetting" ADD CONSTRAINT "StoreSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma does not currently model PostgreSQL exclusion constraints. Keep this
-- migration in place when regenerating the Prisma schema migrations.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_no_overlapping_active_staff_bookings"
EXCLUDE USING gist (
  "staffId" WITH =,
  tstzrange("reservedStartAt", "reservedEndAt", '[)') WITH &&
)
WHERE (
  "staffId" IS NOT NULL
  AND "status" IN (
    'PENDING',
    'PENDING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS'
  )
);

COMMENT ON CONSTRAINT "Appointment_no_overlapping_active_staff_bookings"
ON "Appointment"
IS 'Prevents concurrent active bookings for a staff member, including service buffers.';

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_contact_required"
    CHECK ("emailNormalized" IS NOT NULL OR "phoneNormalized" IS NOT NULL),
  ADD CONSTRAINT "Appointment_time_order"
    CHECK (
      "reservedStartAt" <= "startAt"
      AND "startAt" < "endAt"
      AND "endAt" <= "reservedEndAt"
    ),
  ADD CONSTRAINT "Appointment_duration_positive"
    CHECK (
      "durationMinutes" > 0
      AND "bufferBeforeMinutes" >= 0
      AND "bufferAfterMinutes" >= 0
    );

ALTER TABLE "BlockedTime"
  ADD CONSTRAINT "BlockedTime_time_order"
    CHECK ("startsAt" < "endsAt");

ALTER TABLE "BusinessHours"
  ADD CONSTRAINT "BusinessHours_valid_minutes"
    CHECK (
      "startMinute" >= 0
      AND "endMinute" <= 1440
      AND "startMinute" < "endMinute"
    );

ALTER TABLE "StaffAvailability"
  ADD CONSTRAINT "StaffAvailability_valid_minutes"
    CHECK (
      "startMinute" >= 0
      AND "endMinute" <= 1440
      AND "startMinute" < "endMinute"
    ),
  ADD CONSTRAINT "StaffAvailability_valid_dates"
    CHECK ("validUntil" IS NULL OR "validFrom" IS NULL OR "validFrom" <= "validUntil");

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_nonnegative_quantities"
    CHECK (
      "quantityOnHand" >= 0
      AND "quantityReserved" >= 0
      AND "reorderLevel" >= 0
    );

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_positive"
    CHECK ("quantity" > 0 AND "unitPriceSnapshot" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_and_money_valid"
    CHECK (
      "quantity" > 0
      AND "unitPrice" >= 0
      AND "subtotal" >= 0
      AND "discountTotal" >= 0
      AND "taxTotal" >= 0
      AND "total" >= 0
    );

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range"
    CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Wishlist"
  ADD CONSTRAINT "Wishlist_owner_required"
    CHECK ("userId" IS NOT NULL OR "sessionTokenHash" IS NOT NULL);

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_owner_required"
    CHECK ("userId" IS NOT NULL OR "sessionTokenHash" IS NOT NULL);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_owner_required"
    CHECK (num_nonnulls("orderId", "appointmentId") = 1),
  ADD CONSTRAINT "Payment_amounts_valid"
    CHECK (
      "amount" >= 0
      AND "refundedAmount" >= 0
      AND "refundedAmount" <= "amount"
    );

CREATE UNIQUE INDEX "User_email_case_insensitive_key"
ON "User" (lower("email"))
WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX "StaffMember_email_case_insensitive_key"
ON "StaffMember" (lower("email"))
WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX "Discount_code_case_insensitive_key"
ON "Discount" (upper("code"));

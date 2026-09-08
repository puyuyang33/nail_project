-- Customer requests remain non-blocking until an administrator accepts them.
ALTER TABLE "Appointment"
DROP CONSTRAINT IF EXISTS "Appointment_no_overlapping_active_staff_bookings";

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_no_overlapping_active_staff_bookings"
EXCLUDE USING gist (
  "staffId" WITH =,
  tstzrange("reservedStartAt", "reservedEndAt", '[)') WITH &&
)
WHERE (
  "staffId" IS NOT NULL
  AND "status" IN (
    'PENDING_PAYMENT',
    'CONFIRMED',
    'IN_PROGRESS'
  )
);

COMMENT ON CONSTRAINT "Appointment_no_overlapping_active_staff_bookings"
ON "Appointment"
IS 'Prevents overlapping accepted or payment-held bookings; pending requests remain non-blocking until admin acceptance.';

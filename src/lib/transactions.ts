import "server-only";
import { Prisma } from "@prisma/client";

export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  maximumAttempts = 3,
) {
  let attempt = 0;
  while (attempt < maximumAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === maximumAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 30 * attempt));
    }
  }
  throw new Error("Transaction retry limit exceeded");
}

export function isRetryableTransactionError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("40001") ||
    message.includes("could not serialize") ||
    message.includes("deadlock detected")
  );
}

export function isAppointmentOverlapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("23P01") ||
    message.includes("Appointment_no_overlapping_active_staff_bookings")
  );
}

import { AppointmentStatus } from "@prisma/client";

export const availabilityBlockingStatuses: AppointmentStatus[] = [
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

export const customerCancellableStatuses = new Set<AppointmentStatus>([
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.CONFIRMED,
]);

export function blocksPublicAvailability(status: AppointmentStatus) {
  return availabilityBlockingStatuses.includes(status);
}

export function canAdminAccept(status: AppointmentStatus) {
  return status === AppointmentStatus.PENDING;
}

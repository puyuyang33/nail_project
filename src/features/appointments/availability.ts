import { addMinutes, areIntervalsOverlapping } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type TimeRange = { start: Date; end: Date };

export function hasConflict(candidate: TimeRange, existing: TimeRange[]) {
  return existing.some((range) =>
    areIntervalsOverlapping(candidate, range, { inclusive: false }),
  );
}

export function buildCandidateRange(
  localDate: string,
  localTime: string,
  durationMinutes: number,
  preparationMinutes: number,
  timezone: string,
) {
  const localStart = `${localDate}T${localTime}:00`;
  if (Number.isNaN(new Date(localStart).getTime())) {
    throw new Error("Invalid appointment date or time");
  }
  const start = fromZonedTime(localStart, timezone);
  return {
    start,
    end: addMinutes(start, durationMinutes + preparationMinutes),
  };
}

export function isWithinBusinessHours(
  candidate: TimeRange,
  openTime: string,
  closeTime: string,
  timezone: string,
) {
  const localStart = toZonedTime(candidate.start, timezone);
  const localEnd = toZonedTime(candidate.end, timezone);
  const date = localStart.toISOString().slice(0, 10);
  const open = new Date(`${date}T${openTime}:00`);
  const close = new Date(`${date}T${closeTime}:00`);
  return localStart >= open && localEnd <= close;
}

export function assertBookable(
  candidate: TimeRange,
  now: Date,
  leadTimeHours: number,
) {
  const earliest = addMinutes(now, leadTimeHours * 60);
  if (candidate.start < earliest) {
    throw new Error("Appointment does not meet the minimum booking lead time");
  }
}

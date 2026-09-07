import { AppointmentStatus, DayOfWeek } from "@prisma/client";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { db } from "@/lib/db";
import { env, serviceReadiness } from "@/lib/env";
import { storeConfig } from "@/config/store";

const querySchema = z.object({
  service: z.string().min(1).max(140),
  date: z.iso.date(),
  artist: z.string().min(1).max(100).default("any"),
});

const activeStatuses: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

export async function GET(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid availability request." },
      { status: 400 },
    );
  }
  if (!serviceReadiness.database) {
    return Response.json({
      times: ["10:00", "11:30", "13:30", "15:00", "16:30", "18:00"],
      source: "demo",
      artists: [{ value: "maya-chen", label: "Maya Chen" }],
    });
  }

  const service = await db.service.findUnique({
    where: { slug: parsed.data.service },
    include: {
      staff: {
        include: { staff: { include: { availability: true } } },
      },
    },
  });
  if (!service?.isActive || !service.isBookable) {
    return Response.json({ times: [] });
  }
  const staffCandidates = service.staff
    .map((relation) => relation.staff)
    .filter(
      (staff) =>
        staff.isActive &&
        (parsed.data.artist === "any" ||
          slugify(staff.displayName) === parsed.data.artist),
    );
  if (!staffCandidates.length) return Response.json({ times: [] });

  const localMidday = fromZonedTime(
    `${parsed.data.date}T12:00:00`,
    env.BUSINESS_TIMEZONE,
  );
  const latest = addMinutes(
    new Date(),
    storeConfig.booking.maxAdvanceDays * 24 * 60,
  );
  if (localMidday > latest) return Response.json({ times: [] });
  const day = dayOfWeek(
    formatInTimeZone(localMidday, env.BUSINESS_TIMEZONE, "EEEE"),
  );
  const hours = await db.businessHours.findFirst({
    where: { dayOfWeek: day, isOpen: true },
    orderBy: { startMinute: "asc" },
  });
  if (!hours) return Response.json({ times: [] });

  const dayStart = fromZonedTime(
    new Date(`${parsed.data.date}T00:00:00`),
    env.BUSINESS_TIMEZONE,
  );
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const [appointments, blocked] = await Promise.all([
    db.appointment.findMany({
      where: {
        staffId: { in: staffCandidates.map((staff) => staff.id) },
        status: { in: activeStatuses },
        reservedStartAt: { lt: dayEnd },
        reservedEndAt: { gt: dayStart },
      },
      select: { staffId: true, reservedStartAt: true, reservedEndAt: true },
    }),
    db.blockedTime.findMany({
      where: {
        OR: [
          { staffId: null },
          { staffId: { in: staffCandidates.map((staff) => staff.id) } },
        ],
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const now = new Date();
  const earliest = addMinutes(now, storeConfig.booking.leadTimeHours * 60);
  const times: string[] = [];
  for (
    let minute = hours.startMinute;
    minute + service.durationMinutes + service.bufferAfterMinutes <=
    hours.endMinute;
    minute += 30
  ) {
    const hour = Math.floor(minute / 60)
      .toString()
      .padStart(2, "0");
    const mins = (minute % 60).toString().padStart(2, "0");
    const label = `${hour}:${mins}`;
    const startsAt = fromZonedTime(
      `${parsed.data.date}T${label}:00`,
      env.BUSINESS_TIMEZONE,
    );
    const reservedStartAt = addMinutes(startsAt, -service.bufferBeforeMinutes);
    const reservedEndAt = addMinutes(
      startsAt,
      service.durationMinutes + service.bufferAfterMinutes,
    );
    if (startsAt < earliest) continue;
    const openStaff = staffCandidates.some((staff) => {
      const followsSchedule = staff.availability.some(
        (rule) =>
          rule.dayOfWeek === day &&
          rule.isAvailable &&
          rule.startMinute <= minute - service.bufferBeforeMinutes &&
          rule.endMinute >=
            minute + service.durationMinutes + service.bufferAfterMinutes &&
          (!rule.validFrom || rule.validFrom <= localMidday) &&
          (!rule.validUntil || rule.validUntil >= localMidday),
      );
      if (!followsSchedule) return false;
      const appointmentConflict = appointments.some(
        (appointment) =>
          appointment.staffId === staff.id &&
          appointment.reservedStartAt < reservedEndAt &&
          appointment.reservedEndAt > reservedStartAt,
      );
      const blockConflict = blocked.some(
        (block) =>
          (block.staffId === null || block.staffId === staff.id) &&
          block.startsAt < reservedEndAt &&
          block.endsAt > reservedStartAt,
      );
      return !appointmentConflict && !blockConflict;
    });
    if (openStaff) times.push(label);
  }

  return Response.json({
    times,
    source: "live",
    artists: staffCandidates.map((staff) => ({
      value: slugify(staff.displayName),
      label: staff.displayName,
    })),
  });
}

function dayOfWeek(value: string): DayOfWeek {
  const normalized = value.toUpperCase();
  if (!(normalized in DayOfWeek)) throw new Error("Unsupported weekday");
  return DayOfWeek[normalized as keyof typeof DayOfWeek];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

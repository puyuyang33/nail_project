import { DayOfWeek } from "@prisma/client";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { db } from "@/lib/db";
import { env, serviceReadiness } from "@/lib/env";
import { storeConfig } from "@/config/store";
import { availabilityBlockingStatuses } from "@/features/appointments/status";

const querySchema = z.object({
  service: z.string().min(1).max(140),
  date: z.iso.date(),
  artist: z.string().min(1).max(100).default("any"),
});

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
    const demoSchedule = [
      {
        artistId: "demo-maya",
        label: "Maya Chen",
        slots: [
          { time: "10:00", state: "open" as const },
          { time: "11:30", state: "busy" as const },
          { time: "13:30", state: "open" as const },
          { time: "15:00", state: "open" as const },
          { time: "16:30", state: "off" as const },
          { time: "18:00", state: "off" as const },
        ],
      },
      {
        artistId: "demo-elise",
        label: "Elise Morgan",
        slots: [
          { time: "10:00", state: "off" as const },
          { time: "11:30", state: "open" as const },
          { time: "13:30", state: "busy" as const },
          { time: "15:00", state: "open" as const },
          { time: "16:30", state: "open" as const },
          { time: "18:00", state: "off" as const },
        ],
      },
    ];
    const selected =
      parsed.data.artist === "any"
        ? demoSchedule
        : demoSchedule.filter(
            (worker) => worker.artistId === parsed.data.artist,
          );
    return Response.json({
      times: [
        ...new Set(
          selected.flatMap((worker) =>
            worker.slots
              .filter((slot) => slot.state === "open")
              .map((slot) => slot.time),
          ),
        ),
      ],
      source: "demo",
      artists: demoSchedule.map((worker) => ({
        value: worker.artistId,
        label: worker.label,
      })),
      schedule: demoSchedule,
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
  const allStaffCandidates = service.staff
    .map((relation) => relation.staff)
    .filter((staff) => staff.isActive);
  const staffCandidates = allStaffCandidates.filter(
    (staff) => parsed.data.artist === "any" || staff.id === parsed.data.artist,
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
    `${parsed.data.date}T00:00:00`,
    env.BUSINESS_TIMEZONE,
  );
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const [appointments, blocked] = await Promise.all([
    db.appointment.findMany({
      where: {
        staffId: { in: allStaffCandidates.map((staff) => staff.id) },
        status: { in: availabilityBlockingStatuses },
        reservedStartAt: { lt: dayEnd },
        reservedEndAt: { gt: dayStart },
      },
      select: { staffId: true, reservedStartAt: true, reservedEndAt: true },
    }),
    db.blockedTime.findMany({
      where: {
        OR: [
          { staffId: null },
          { staffId: { in: allStaffCandidates.map((staff) => staff.id) } },
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
  const schedule = new Map<
    string,
    Array<{ time: string; state: "open" | "busy" | "off" }>
  >(allStaffCandidates.map((staff) => [staff.id, []]));
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
    const states = new Map<
      string,
      { time: string; state: "open" | "busy" | "off" }
    >();
    for (const staff of allStaffCandidates) {
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
      const state =
        !followsSchedule || blockConflict
          ? "off"
          : appointmentConflict
            ? "busy"
            : "open";
      const slot = { time: label, state } as const;
      schedule.get(staff.id)?.push(slot);
      states.set(staff.id, slot);
    }
    const openStaff = staffCandidates.some(
      (staff) => states.get(staff.id)?.state === "open",
    );
    if (openStaff) times.push(label);
  }

  return Response.json({
    times,
    source: "live",
    artists: allStaffCandidates.map((staff) => ({
      value: staff.id,
      label: staff.displayName,
    })),
    schedule: allStaffCandidates.map((staff) => ({
      artistId: staff.id,
      label: staff.displayName,
      slots: schedule.get(staff.id) ?? [],
    })),
  });
}

function dayOfWeek(value: string): DayOfWeek {
  const normalized = value.toUpperCase();
  if (!(normalized in DayOfWeek)) throw new Error("Unsupported weekday");
  return DayOfWeek[normalized as keyof typeof DayOfWeek];
}

"use server";

import { DayOfWeek, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { availabilityBlockingStatuses } from "@/features/appointments/status";
import { withTransactionRetry } from "@/lib/transactions";

const optionalEmail = z.union([z.email(), z.literal("")]);
const staffSchema = z.object({
  locale: z.enum(["en", "zh"]),
  displayName: z.string().trim().min(2).max(100),
  email: optionalEmail,
  phone: z.string().trim().max(30).optional(),
  bio: z.string().trim().max(1000).optional(),
});

export async function createStaffMember(formData: FormData) {
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Worker details are invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const serviceIds = uniqueStrings(formData.getAll("serviceIds"));
  await database.$transaction(async (tx) => {
    await assertActiveServices(tx, serviceIds);
    const last = await tx.staffMember.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const worker = await tx.staffMember.create({
      data: {
        displayName: parsed.data.displayName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
        position: (last?.position ?? 0) + 10,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "staff.create",
        entityType: "StaffMember",
        entityId: worker.id,
        after: {
          displayName: worker.displayName,
          serviceIds,
        },
      },
    });
  });
  revalidateStaff(parsed.data.locale);
}

const updateStaffSchema = staffSchema.extend({
  id: z.string().min(1),
  intent: z.enum(["save", "retire", "reactivate"]),
});

export async function updateStaffMember(formData: FormData) {
  const parsed = updateStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Worker update is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const serviceIds = uniqueStrings(formData.getAll("serviceIds"));
  const isActive =
    parsed.data.intent === "retire"
      ? false
      : parsed.data.intent === "reactivate"
        ? true
        : undefined;

  await withTransactionRetry(() =>
    database.$transaction(
      async (tx) => {
        if (parsed.data.intent === "save") {
          await assertActiveServices(tx, serviceIds);
        }
        const current = await tx.staffMember.findUniqueOrThrow({
          where: { id: parsed.data.id },
        });
        if (isActive === false) {
          const futureAppointments = await tx.appointment.count({
            where: {
              staffId: current.id,
              status: { in: availabilityBlockingStatuses },
              startAt: { gt: new Date() },
            },
          });
          if (futureAppointments) {
            throw new Error(
              "Reassign or cancel this worker's future appointments before retiring them.",
            );
          }
        }
        const worker = await tx.staffMember.update({
          where: { id: current.id },
          data: {
            displayName: parsed.data.displayName,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            bio: parsed.data.bio || null,
            ...(isActive === undefined ? {} : { isActive }),
          },
        });
        if (parsed.data.intent === "save") {
          await tx.staffService.deleteMany({ where: { staffId: worker.id } });
          if (serviceIds.length) {
            await tx.staffService.createMany({
              data: serviceIds.map((serviceId) => ({
                staffId: worker.id,
                serviceId,
              })),
              skipDuplicates: true,
            });
          }
        }
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action:
              parsed.data.intent === "save"
                ? "staff.update"
                : `staff.${parsed.data.intent}`,
            entityType: "StaffMember",
            entityId: worker.id,
            before: {
              displayName: current.displayName,
              isActive: current.isActive,
            },
            after: {
              displayName: worker.displayName,
              isActive: worker.isActive,
              ...(parsed.data.intent === "save" ? { serviceIds } : {}),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  revalidateStaff(parsed.data.locale);
}

const availabilitySchema = z
  .object({
    locale: z.enum(["en", "zh"]),
    staffId: z.string().min(1),
    dayOfWeek: z.nativeEnum(DayOfWeek),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .transform((value) => ({
    ...value,
    startMinute: toMinute(value.startTime),
    endMinute: toMinute(value.endTime),
  }))
  .refine((value) => value.startMinute < value.endMinute, {
    message: "Availability must end after it starts.",
  });

export async function addStaffAvailability(formData: FormData) {
  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Availability rule is invalid.",
    );
  }
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  await database.$transaction(async (tx) => {
    const availability = await tx.staffAvailability.upsert({
      where: {
        staffId_dayOfWeek_startMinute_endMinute: {
          staffId: parsed.data.staffId,
          dayOfWeek: parsed.data.dayOfWeek,
          startMinute: parsed.data.startMinute,
          endMinute: parsed.data.endMinute,
        },
      },
      update: { isAvailable: true },
      create: {
        staffId: parsed.data.staffId,
        dayOfWeek: parsed.data.dayOfWeek,
        startMinute: parsed.data.startMinute,
        endMinute: parsed.data.endMinute,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "staff.availability.create",
        entityType: "StaffAvailability",
        entityId: availability.id,
        after: {
          staffId: parsed.data.staffId,
          dayOfWeek: parsed.data.dayOfWeek,
          startMinute: parsed.data.startMinute,
          endMinute: parsed.data.endMinute,
        },
      },
    });
  });
  revalidateStaff(parsed.data.locale);
}

export async function removeStaffAvailability(formData: FormData) {
  const parsed = z
    .object({
      locale: z.enum(["en", "zh"]),
      id: z.string().min(1),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Availability removal is invalid.");
  const actor = await requireAdmin(parsed.data.locale);
  const database = requireDatabase();
  const rule = await database.staffAvailability.findUniqueOrThrow({
    where: { id: parsed.data.id },
  });
  await database.$transaction([
    database.staffAvailability.delete({ where: { id: rule.id } }),
    database.auditLog.create({
      data: {
        actorId: actor.id,
        action: "staff.availability.delete",
        entityType: "StaffAvailability",
        entityId: rule.id,
        before: {
          staffId: rule.staffId,
          dayOfWeek: rule.dayOfWeek,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        },
      },
    }),
  ]);
  revalidateStaff(parsed.data.locale);
}

function uniqueStrings(values: FormDataEntryValue[]) {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === "string"),
    ),
  ];
}

async function assertActiveServices(
  tx: Prisma.TransactionClient,
  serviceIds: string[],
) {
  if (!serviceIds.length) return;
  const count = await tx.service.count({
    where: { id: { in: serviceIds }, isActive: true },
  });
  if (count !== serviceIds.length) {
    throw new Error("One or more selected services are unavailable.");
  }
}

function toMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function revalidateStaff(locale: string) {
  revalidatePath(`/${locale}/admin/staff`);
  revalidatePath(`/${locale}/admin/calendar`);
  revalidatePath(`/${locale}/book`);
  revalidatePath(`/api/availability`);
}

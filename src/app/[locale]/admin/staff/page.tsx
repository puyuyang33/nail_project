import { DayOfWeek } from "@prisma/client";
import { CalendarDays, UserMinus, UserPlus } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import {
  addStaffAvailability,
  createStaffMember,
  removeStaffAvailability,
  updateStaffMember,
} from "../staff-actions";

export default async function AdminStaffPage({
  params,
}: PageProps<"/[locale]/admin/staff">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const database = requireDatabase();
  const [staff, services] = await Promise.all([
    database.staffMember.findMany({
      include: {
        services: {
          include: {
            service: {
              include: {
                translations: { where: { locale: "en" }, take: 1 },
              },
            },
          },
        },
        availability: {
          orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
        },
        _count: { select: { appointments: true } },
      },
      orderBy: [{ isActive: "desc" }, { position: "asc" }],
    }),
    database.service.findMany({
      where: { isActive: true },
      include: {
        translations: { where: { locale: "en" }, take: 1 },
      },
      orderBy: { position: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-wine">Workforce</p>
          <h1 className="display mt-4 text-6xl">Workers</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/55">
            Manage who can be booked, which services each worker performs, and
            their recurring weekly hours. Retiring a worker preserves history.
          </p>
        </div>
        <Link href="/admin/calendar" className="button-secondary">
          <CalendarDays size={16} /> Team calendar
        </Link>
      </div>

      <div className="mt-10 space-y-5">
        {staff.map((worker) => (
          <article
            key={worker.id}
            className={`border p-6 ${
              worker.isActive
                ? "bg-porcelain border-black/15"
                : "bg-paper-deep/45 border-black/10 text-black/55"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="eyebrow text-wine">
                  {worker.isActive ? "Active worker" : "Retired worker"}
                </p>
                <h2 className="display mt-2 text-4xl">{worker.displayName}</h2>
                <p className="mt-2 text-xs text-black/45">
                  {worker._count.appointments} historical appointments
                </p>
              </div>
              <form action={updateStaffMember}>
                <input type="hidden" name="locale" value={safeLocale} />
                <input type="hidden" name="id" value={worker.id} />
                <input
                  type="hidden"
                  name="displayName"
                  value={worker.displayName}
                />
                <input type="hidden" name="email" value={worker.email ?? ""} />
                <input type="hidden" name="phone" value={worker.phone ?? ""} />
                <input type="hidden" name="bio" value={worker.bio ?? ""} />
                {worker.services.map(({ serviceId }) => (
                  <input
                    type="hidden"
                    name="serviceIds"
                    value={serviceId}
                    key={serviceId}
                  />
                ))}
                <button
                  name="intent"
                  value={worker.isActive ? "retire" : "reactivate"}
                  className="button-secondary"
                >
                  {worker.isActive ? (
                    <>
                      <UserMinus size={15} /> Retire worker
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} /> Reactivate
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_0.9fr]">
              <form
                action={updateStaffMember}
                className="grid gap-4 sm:grid-cols-2"
              >
                <input type="hidden" name="locale" value={safeLocale} />
                <input type="hidden" name="id" value={worker.id} />
                <StaffField
                  label="Display name"
                  name="displayName"
                  defaultValue={worker.displayName}
                />
                <StaffField
                  label="Email notifications"
                  name="email"
                  type="email"
                  defaultValue={worker.email ?? ""}
                  required={false}
                />
                <StaffField
                  label="Phone"
                  name="phone"
                  defaultValue={worker.phone ?? ""}
                  required={false}
                />
                <label className="sm:col-span-2">
                  <span className="field-label">Bio</span>
                  <textarea
                    className="field min-h-24"
                    name="bio"
                    defaultValue={worker.bio ?? ""}
                  />
                </label>
                <fieldset className="sm:col-span-2">
                  <legend className="field-label">Services</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {services.map((service) => (
                      <label
                        key={service.id}
                        className="flex items-center gap-2 border border-black/10 p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          defaultChecked={worker.services.some(
                            (item) => item.serviceId === service.id,
                          )}
                          className="accent-wine"
                        />
                        {service.translations[0]?.name ?? service.slug}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button
                  name="intent"
                  value="save"
                  className="button-primary w-fit sm:col-span-2"
                >
                  Save worker
                </button>
              </form>

              <div>
                <p className="field-label">Weekly availability</p>
                <div className="divide-y divide-black/10 border-y border-black/10">
                  {worker.availability.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span>
                        <strong>{titleCase(rule.dayOfWeek)}</strong>{" "}
                        {minuteToTime(rule.startMinute)}–
                        {minuteToTime(rule.endMinute)}
                      </span>
                      <form action={removeStaffAvailability}>
                        <input type="hidden" name="locale" value={safeLocale} />
                        <input type="hidden" name="id" value={rule.id} />
                        <button className="text-wine text-xs underline">
                          Remove
                        </button>
                      </form>
                    </div>
                  ))}
                  {!worker.availability.length && (
                    <p className="py-4 text-sm text-black/45">
                      No bookable hours yet.
                    </p>
                  )}
                </div>
                {worker.isActive && (
                  <form
                    action={addStaffAvailability}
                    className="mt-5 grid grid-cols-2 gap-3"
                  >
                    <input type="hidden" name="locale" value={safeLocale} />
                    <input type="hidden" name="staffId" value={worker.id} />
                    <label className="col-span-2">
                      <span className="field-label">Day</span>
                      <select className="field" name="dayOfWeek">
                        {Object.values(DayOfWeek).map((day) => (
                          <option key={day} value={day}>
                            {titleCase(day)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <StaffField
                      label="Starts"
                      name="startTime"
                      type="time"
                      defaultValue="10:00"
                    />
                    <StaffField
                      label="Ends"
                      name="endTime"
                      type="time"
                      defaultValue="18:00"
                    />
                    <button className="button-secondary col-span-2">
                      Add weekly hours
                    </button>
                  </form>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="bg-porcelain mt-12 border border-black/15 p-7">
        <p className="eyebrow text-wine">New team member</p>
        <h2 className="display mt-3 text-4xl">Add worker</h2>
        <form
          action={createStaffMember}
          className="mt-7 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="locale" value={safeLocale} />
          <StaffField label="Display name" name="displayName" />
          <StaffField
            label="Email notifications"
            name="email"
            type="email"
            required={false}
          />
          <StaffField label="Phone" name="phone" required={false} />
          <label className="sm:col-span-2">
            <span className="field-label">Bio</span>
            <textarea className="field min-h-24" name="bio" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="field-label">Services</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-2 border border-black/10 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    className="accent-wine"
                  />
                  {service.translations[0]?.name ?? service.slug}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="button-primary w-fit sm:col-span-2">
            <UserPlus size={16} /> Add worker
          </button>
        </form>
      </section>
    </div>
  );
}

function StaffField({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input
        className="field"
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </label>
  );
}

function minuteToTime(value: number) {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

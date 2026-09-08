import { AppointmentStatus, DayOfWeek, Prisma } from "@prisma/client";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ArrowLeft, ArrowRight, CalendarPlus, UserRoundX } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import {
  acceptAppointmentRequest,
  createAdminAppointment,
  createWorkerTimeOff,
  declineAppointmentRequest,
  moveTeamAppointment,
  removeWorkerTimeOff,
  setAppointmentOperationalStatus,
} from "../scheduling-actions";
import { availabilityBlockingStatuses } from "@/features/appointments/status";

type CalendarAppointment = Prisma.AppointmentGetPayload<{
  include: { staff: true };
}>;
type CalendarWorker = Prisma.StaffMemberGetPayload<{
  include: { services: true };
}>;

export default async function AdminCalendarPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/calendar">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const requestedDate =
    typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
      ? query.date
      : formatInTimeZone(new Date(), env.BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const dayStart = fromZonedTime(
    `${requestedDate}T00:00:00`,
    env.BUSINESS_TIMEZONE,
  );
  const dayEnd = addDays(dayStart, 1);
  const weekday = formatInTimeZone(
    dayStart,
    env.BUSINESS_TIMEZONE,
    "EEEE",
  ).toUpperCase() as DayOfWeek;
  const database = requireDatabase();
  const [workers, appointments, blockedTimes, services, businessHours] =
    await Promise.all([
      database.staffMember.findMany({
        where: { isActive: true },
        include: { services: true },
        orderBy: { position: "asc" },
      }),
      database.appointment.findMany({
        where: {
          reservedStartAt: { lt: dayEnd },
          reservedEndAt: { gt: dayStart },
          status: {
            notIn: [AppointmentStatus.CANCELED, AppointmentStatus.EXPIRED],
          },
        },
        include: { staff: true },
        orderBy: { startAt: "asc" },
      }),
      database.blockedTime.findMany({
        where: {
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        include: { staff: true },
        orderBy: { startsAt: "asc" },
      }),
      database.service.findMany({
        where: { isActive: true, isBookable: true },
        include: {
          translations: { where: { locale: "en" }, take: 1 },
        },
        orderBy: { position: "asc" },
      }),
      database.businessHours.findMany({
        where: { dayOfWeek: weekday, isOpen: true },
        orderBy: { startMinute: "asc" },
      }),
    ]);

  const pending = appointments.filter(
    (appointment) => appointment.status === AppointmentStatus.PENDING,
  );
  const calendarAppointments = appointments.filter((appointment) =>
    [...availabilityBlockingStatuses, AppointmentStatus.COMPLETED].includes(
      appointment.status,
    ),
  );
  const startMinute = businessHours.length
    ? Math.min(...businessHours.map((item) => item.startMinute))
    : 8 * 60;
  const endMinute = businessHours.length
    ? Math.max(...businessHours.map((item) => item.endMinute))
    : 20 * 60;
  const previousDate = formatInTimeZone(
    addDays(dayStart, -1),
    env.BUSINESS_TIMEZONE,
    "yyyy-MM-dd",
  );
  const nextDate = formatInTimeZone(
    addDays(dayStart, 1),
    env.BUSINESS_TIMEZONE,
    "yyyy-MM-dd",
  );

  return (
    <div>
      <header className="flex flex-col gap-5 border-b border-black/15 pb-7 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-wine">Team operations</p>
          <h1 className="display mt-4 text-6xl">Day calendar</h1>
          <p className="mt-3 text-sm text-black/50">
            {formatInTimeZone(dayStart, env.BUSINESS_TIMEZONE, "EEEE, PPP")} ·{" "}
            {env.BUSINESS_TIMEZONE}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/calendar?date=${previousDate}`}
            className="grid size-11 place-items-center border border-black/20"
            aria-label="Previous day"
          >
            <ArrowLeft size={17} />
          </Link>
          <Link href="/admin/calendar" className="button-secondary">
            Today
          </Link>
          <Link
            href={`/admin/calendar?date=${nextDate}`}
            className="grid size-11 place-items-center border border-black/20"
            aria-label="Next day"
          >
            <ArrowRight size={17} />
          </Link>
        </div>
      </header>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow text-wine">Approval queue</p>
            <h2 className="display mt-2 text-4xl">New requests</h2>
          </div>
          <span className="bg-acid grid size-11 place-items-center rounded-full text-sm font-bold">
            {pending.length}
          </span>
        </div>
        {pending.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {pending.map((appointment) => {
              const capableWorkers = workers.filter((worker) =>
                worker.services.some(
                  (relation) => relation.serviceId === appointment.serviceId,
                ),
              );
              return (
                <article
                  key={appointment.id}
                  className="border-wine/35 bg-acid/20 border p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow text-wine">
                        {appointment.confirmationNumber}
                      </p>
                      <h3 className="display mt-2 text-3xl">
                        {appointment.customerNameSnapshot}
                      </h3>
                      <p className="mt-2 text-sm">
                        {appointment.serviceNameSnapshot} ·{" "}
                        {formatInTimeZone(
                          appointment.startAt,
                          appointment.timezone,
                          "p",
                        )}
                      </p>
                      <p className="mt-1 text-xs text-black/45">
                        Requested worker:{" "}
                        {appointment.staff?.displayName ?? "First available"}
                      </p>
                    </div>
                    <span className="bg-acid px-2 py-1 text-[0.6rem] font-bold uppercase">
                      Pending
                    </span>
                  </div>
                  {appointment.customerNotes && (
                    <p className="border-wine mt-4 border-l-2 pl-3 text-sm leading-6 text-black/60">
                      {appointment.customerNotes}
                    </p>
                  )}
                  <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <form
                      action={acceptAppointmentRequest}
                      className="flex gap-2"
                    >
                      <input type="hidden" name="locale" value={safeLocale} />
                      <input type="hidden" name="id" value={appointment.id} />
                      <select
                        className="field !min-h-10 flex-1 !py-1"
                        name="staffId"
                        aria-label={`Worker for ${appointment.confirmationNumber}`}
                        defaultValue={
                          appointment.staffId ?? capableWorkers[0]?.id
                        }
                        required
                      >
                        {capableWorkers.map((worker) => (
                          <option key={worker.id} value={worker.id}>
                            {worker.displayName}
                          </option>
                        ))}
                      </select>
                      <button className="button-primary !min-h-10 !px-4">
                        Accept
                      </button>
                    </form>
                    <form action={declineAppointmentRequest}>
                      <input type="hidden" name="locale" value={safeLocale} />
                      <input type="hidden" name="id" value={appointment.id} />
                      <input
                        type="hidden"
                        name="reason"
                        value="The studio could not accept this requested time."
                      />
                      <button className="button-secondary !min-h-10 !px-4">
                        Decline
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-porcelain mt-5 border border-black/10 p-7 text-sm text-black/45">
            No appointment requests are waiting for approval on this day.
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow text-wine">Accepted workload</p>
            <h2 className="display mt-2 text-4xl">Worker timelines</h2>
          </div>
          <Link href="/admin/staff" className="text-xs underline">
            Manage workers
          </Link>
        </div>
        <TeamTimeline
          workers={workers}
          appointments={calendarAppointments}
          blockedTimes={blockedTimes}
          startMinute={startMinute}
          endMinute={endMinute}
        />
      </section>

      <section className="mt-12 grid gap-6 xl:grid-cols-2">
        <div className="bg-porcelain border border-black/15 p-6">
          <p className="eyebrow text-wine">Boss-created booking</p>
          <h2 className="display mt-3 text-4xl">Add appointment</h2>
          <form
            action={createAdminAppointment}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="locale" value={safeLocale} />
            <CalendarField label="Customer name" name="customerName" />
            <CalendarField
              label="Email"
              name="email"
              type="email"
              required={false}
            />
            <CalendarField label="Phone" name="phone" required={false} />
            <label>
              <span className="field-label">Service</span>
              <select className="field" name="serviceId" required>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.translations[0]?.name ?? service.slug}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Worker</span>
              <select className="field" name="staffId" required>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.displayName}
                  </option>
                ))}
              </select>
            </label>
            <CalendarField
              label="Start"
              name="localStart"
              type="datetime-local"
              defaultValue={`${requestedDate}T10:00`}
            />
            <label className="sm:col-span-2">
              <span className="field-label">Notes</span>
              <textarea className="field min-h-24" name="notes" />
            </label>
            <button className="button-primary w-fit sm:col-span-2">
              <CalendarPlus size={16} /> Add confirmed appointment
            </button>
          </form>
        </div>

        <div className="bg-porcelain border border-black/15 p-6">
          <p className="eyebrow text-wine">Worker absence</p>
          <h2 className="display mt-3 text-4xl">Mark time off</h2>
          <form
            action={createWorkerTimeOff}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="locale" value={safeLocale} />
            <label className="sm:col-span-2">
              <span className="field-label">Worker</span>
              <select className="field" name="staffId" required>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.displayName}
                  </option>
                ))}
              </select>
            </label>
            <CalendarField
              label="Starts"
              name="localStart"
              type="datetime-local"
              defaultValue={`${requestedDate}T09:00`}
            />
            <CalendarField
              label="Ends"
              name="localEnd"
              type="datetime-local"
              defaultValue={`${requestedDate}T18:00`}
            />
            <label className="sm:col-span-2">
              <span className="field-label">Reason</span>
              <input
                className="field"
                name="reason"
                defaultValue="Approved time off"
                required
              />
            </label>
            <button className="button-secondary w-fit sm:col-span-2">
              <UserRoundX size={16} /> Block worker time
            </button>
          </form>
        </div>
      </section>

      <section className="mt-12">
        <p className="eyebrow text-wine">Day management</p>
        <h2 className="display mt-3 text-4xl">Accepted appointments</h2>
        <div className="mt-5 space-y-3">
          {calendarAppointments.map((appointment) => (
            <article
              key={appointment.id}
              className="bg-porcelain grid gap-4 border border-black/15 p-5 xl:grid-cols-[1fr_1.2fr_auto]"
            >
              <div>
                <strong className="display text-2xl">
                  {appointment.customerNameSnapshot}
                </strong>
                <p className="mt-1 text-xs text-black/45">
                  {appointment.serviceNameSnapshot} ·{" "}
                  {appointment.confirmationNumber}
                </p>
              </div>
              {appointment.status === AppointmentStatus.COMPLETED ? (
                <p className="text-sm text-black/45">
                  Completed at{" "}
                  {appointment.completedAt?.toLocaleTimeString() ?? "—"}
                </p>
              ) : (
                <form
                  action={moveTeamAppointment}
                  className="flex flex-wrap gap-2"
                >
                  <input type="hidden" name="locale" value={safeLocale} />
                  <input type="hidden" name="id" value={appointment.id} />
                  <select
                    className="field !min-h-10 !w-auto !py-1"
                    name="staffId"
                    aria-label={`Reassign ${appointment.confirmationNumber}`}
                    defaultValue={appointment.staffId ?? ""}
                    required
                  >
                    {workers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.displayName}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field !min-h-10 !w-auto !py-1"
                    type="datetime-local"
                    name="localStart"
                    aria-label={`New start time for ${appointment.confirmationNumber}`}
                    defaultValue={formatInTimeZone(
                      appointment.startAt,
                      appointment.timezone,
                      "yyyy-MM-dd'T'HH:mm",
                    )}
                    required
                  />
                  <button className="border border-black/20 px-3 text-xs">
                    Move
                  </button>
                </form>
              )}
              <div className="flex flex-wrap gap-2">
                {appointment.status === AppointmentStatus.CONFIRMED && (
                  <StatusButton
                    locale={safeLocale}
                    id={appointment.id}
                    status="IN_PROGRESS"
                    label="Start"
                  />
                )}
                {appointment.status === AppointmentStatus.IN_PROGRESS && (
                  <StatusButton
                    locale={safeLocale}
                    id={appointment.id}
                    status="COMPLETED"
                    label="Complete"
                  />
                )}
                {(appointment.status === AppointmentStatus.CONFIRMED ||
                  appointment.status === AppointmentStatus.IN_PROGRESS) && (
                  <StatusButton
                    locale={safeLocale}
                    id={appointment.id}
                    status="CANCELED"
                    label="Cancel"
                  />
                )}
                {appointment.status === AppointmentStatus.PENDING_PAYMENT && (
                  <form action={declineAppointmentRequest}>
                    <input type="hidden" name="locale" value={safeLocale} />
                    <input type="hidden" name="id" value={appointment.id} />
                    <input
                      type="hidden"
                      name="reason"
                      value="The deposit was not completed in time."
                    />
                    <button className="border border-black/20 px-3 py-2 text-xs">
                      Release hold
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {blockedTimes.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow text-wine">Time off and blocks</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {blockedTimes.map((blocked) => (
              <article
                key={blocked.id}
                className="flex items-center justify-between gap-4 border border-black/15 p-4"
              >
                <div className="text-sm">
                  <strong>
                    {blocked.staff?.displayName ?? "Entire studio"}
                  </strong>
                  <p className="mt-1 text-xs text-black/45">
                    {formatInTimeZone(
                      blocked.startsAt,
                      env.BUSINESS_TIMEZONE,
                      "p",
                    )}
                    –
                    {formatInTimeZone(
                      blocked.endsAt,
                      env.BUSINESS_TIMEZONE,
                      "p",
                    )}{" "}
                    · {blocked.reason}
                  </p>
                </div>
                <form action={removeWorkerTimeOff}>
                  <input type="hidden" name="locale" value={safeLocale} />
                  <input type="hidden" name="id" value={blocked.id} />
                  <button className="text-wine text-xs underline">
                    Remove
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamTimeline({
  workers,
  appointments,
  blockedTimes,
  startMinute,
  endMinute,
}: {
  workers: CalendarWorker[];
  appointments: CalendarAppointment[];
  blockedTimes: Array<{
    id: string;
    staffId: string | null;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }>;
  startMinute: number;
  endMinute: number;
}) {
  const pixelsPerMinute = 1.1;
  const height = (endMinute - startMinute) * pixelsPerMinute;
  const markers = Array.from(
    { length: Math.floor((endMinute - startMinute) / 30) + 1 },
    (_, index) => startMinute + index * 30,
  );

  return (
    <div className="bg-porcelain overflow-x-auto border border-black/15">
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `5rem repeat(${Math.max(workers.length, 1)}, minmax(15rem, 1fr))`,
        }}
      >
        <div className="bg-ink sticky left-0 z-30 border-r border-b border-black/15" />
        {workers.map((worker) => (
          <div
            key={worker.id}
            className="bg-ink text-paper sticky top-0 z-20 border-r border-b border-black/15 p-4 text-center"
          >
            <p className="display text-2xl">{worker.displayName}</p>
            <p className="text-paper/50 mt-1 text-[0.6rem] tracking-wider uppercase">
              {worker.services.length} services
            </p>
          </div>
        ))}
        <div
          className="bg-paper sticky left-0 z-20 border-r border-black/15"
          style={{ height }}
        >
          {markers.map((minute) => (
            <span
              key={minute}
              className="absolute right-3 -translate-y-1/2 text-[0.6rem] font-bold text-black/45"
              style={{ top: (minute - startMinute) * pixelsPerMinute }}
            >
              {minuteToTime(minute)}
            </span>
          ))}
        </div>
        {workers.map((worker) => (
          <div
            key={worker.id}
            className="relative border-r border-black/15"
            style={{ height }}
          >
            {markers.map((minute) => (
              <div
                key={minute}
                className="absolute inset-x-0 border-t border-black/[0.07]"
                style={{ top: (minute - startMinute) * pixelsPerMinute }}
              />
            ))}
            {blockedTimes
              .filter(
                (blocked) =>
                  blocked.staffId === null || blocked.staffId === worker.id,
              )
              .map((blocked) => {
                const blockStart = localMinute(blocked.startsAt);
                const blockEnd = localMinute(blocked.endsAt);
                return (
                  <div
                    key={blocked.id}
                    className="absolute inset-x-2 z-10 overflow-hidden border border-black/15 bg-[repeating-linear-gradient(135deg,#e9e0d3,#e9e0d3_8px,#f6f1e8_8px,#f6f1e8_16px)] p-2 text-[0.65rem] text-black/55"
                    style={{
                      top:
                        Math.max(0, blockStart - startMinute) * pixelsPerMinute,
                      height:
                        Math.max(30, blockEnd - blockStart) * pixelsPerMinute,
                    }}
                  >
                    Off · {blocked.reason ?? "Unavailable"}
                  </div>
                );
              })}
            {appointments
              .filter((appointment) => appointment.staffId === worker.id)
              .map((appointment) => {
                const appointmentStart = localMinute(appointment.startAt);
                const statusClass =
                  appointment.status === AppointmentStatus.CONFIRMED
                    ? "bg-wine text-white"
                    : appointment.status === AppointmentStatus.PENDING_PAYMENT
                      ? "bg-amber-200 text-ink"
                      : appointment.status === AppointmentStatus.IN_PROGRESS
                        ? "bg-acid text-ink"
                        : "bg-paper-deep text-ink";
                return (
                  <div
                    key={appointment.id}
                    className={`absolute inset-x-2 z-10 overflow-hidden border border-black/15 p-2 shadow-sm ${statusClass}`}
                    style={{
                      top:
                        Math.max(0, appointmentStart - startMinute) *
                        pixelsPerMinute,
                      height: Math.max(
                        42,
                        appointment.durationMinutes * pixelsPerMinute,
                      ),
                    }}
                  >
                    <p className="truncate text-[0.65rem] font-bold">
                      {appointment.customerNameSnapshot}
                    </p>
                    <p className="mt-1 truncate text-[0.58rem] opacity-75">
                      {formatInTimeZone(
                        appointment.startAt,
                        appointment.timezone,
                        "p",
                      )}{" "}
                      · {appointment.serviceNameSnapshot}
                    </p>
                  </div>
                );
              })}
          </div>
        ))}
        {!workers.length && (
          <div className="p-8 text-sm text-black/45">
            Add an active worker before using the team calendar.
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarField({
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

function StatusButton({
  locale,
  id,
  status,
  label,
}: {
  locale: Locale;
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELED";
  label: string;
}) {
  return (
    <form action={setAppointmentOperationalStatus}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="border border-black/20 px-3 py-2 text-xs">
        {label}
      </button>
    </form>
  );
}

function localMinute(date: Date) {
  return (
    Number(formatInTimeZone(date, env.BUSINESS_TIMEZONE, "H")) * 60 +
    Number(formatInTimeZone(date, env.BUSINESS_TIMEZONE, "m"))
  );
}

function minuteToTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

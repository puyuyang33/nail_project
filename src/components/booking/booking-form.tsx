"use client";

import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/routing";
import type { Service } from "@/types/catalog";
import { formatMoney, localize, minutesToDuration } from "@/lib/utils";

const availableTimes = ["10:00", "11:30", "13:30", "15:00", "16:30", "18:00"];

function getDateOptions() {
  const options: string[] = [];
  const now = new Date();
  for (let offset = 1; options.length < 10; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    if (date.getDay() !== 0) options.push(date.toISOString().slice(0, 10));
  }
  return options;
}

export function BookingForm({
  initialService,
  services,
}: {
  initialService?: string;
  services: Service[];
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Booking");
  const router = useRouter();
  const [dates] = useState(() => getDateOptions());
  const [date, setDate] = useState(dates[0]);
  const [artist, setArtist] = useState("any");
  const [artists, setArtists] = useState([
    { value: "demo-maya", label: "Maya Chen" },
  ]);
  const [schedule, setSchedule] = useState<
    Array<{
      artistId: string;
      label: string;
      slots: Array<{ time: string; state: "open" | "busy" | "off" }>;
    }>
  >([]);
  const [timeOptions, setTimeOptions] = useState(availableTimes);
  const [selectedTime, setSelectedTime] = useState(availableTimes[0]);
  const [scheduleSource, setScheduleSource] = useState<"demo" | "live">("demo");
  const [serviceSlug, setServiceSlug] = useState(
    initialService &&
      services.some((service) => service.slug === initialService)
      ? initialService
      : services[0].slug,
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const selectedService =
    services.find((service) => service.slug === serviceSlug) ?? services[0];

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      service: serviceSlug,
      date,
      artist,
    });
    fetch(`/api/availability?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as {
          times?: string[];
          source?: "demo" | "live";
          artists?: Array<{ value: string; label: string }>;
          schedule?: Array<{
            artistId: string;
            label: string;
            slots: Array<{
              time: string;
              state: "open" | "busy" | "off";
            }>;
          }>;
        };
        const nextTimes = body.times ?? [];
        setTimeOptions(nextTimes);
        setSelectedTime((current) =>
          nextTimes.includes(current) ? current : (nextTimes[0] ?? ""),
        );
        setScheduleSource(body.source ?? "live");
        if (body.artists) setArtists(body.artists);
        if (body.schedule) setSchedule(body.schedule);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setTimeOptions([]);
        }
      });
    return () => controller.abort();
  }, [artist, date, serviceSlug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, locale }),
    });
    const body = (await response.json()) as {
      reference?: string;
      checkoutUrl?: string;
      error?: string;
    };
    if (!response.ok || !body.reference) {
      setError(body.error ?? "The appointment could not be reserved.");
      setStatus("error");
      return;
    }
    if (body.checkoutUrl) {
      window.location.assign(body.checkoutUrl);
      return;
    }
    router.push(`/book/confirmation?reference=${body.reference}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <label>
          <span className="field-label">{t("service")}</span>
          <select
            name="service"
            className="field"
            value={serviceSlug}
            onChange={(event) => {
              setServiceSlug(event.target.value);
              setArtist("any");
            }}
          >
            {services.map((service) => (
              <option value={service.slug} key={service.slug}>
                {localize(service.name, locale)} —{" "}
                {formatMoney(service.price, locale)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            <span className="field-label">{t("artist")}</span>
            <select
              name="artist"
              className="field"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
            >
              <option value="any">{t("anyArtist")}</option>
              {artists.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">{t("date")}</span>
            <select
              name="date"
              className="field"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {new Intl.DateTimeFormat(
                    locale === "zh" ? "zh-CN" : "en-US",
                    { weekday: "short", month: "short", day: "numeric" },
                  ).format(new Date(`${date}T12:00:00`))}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="field-label">{t("teamAvailability")}</legend>
          <WorkerAvailabilityGrid
            schedule={schedule}
            selectedArtist={artist}
            selectedTime={selectedTime}
            onSelect={(artistId, time) => {
              setArtist(artistId);
              setSelectedTime(time);
            }}
          />
          <p className="mt-3 text-xs leading-5 text-black/45">
            {t("availabilityNote")}
          </p>
        </fieldset>

        <fieldset>
          <legend className="field-label flex items-center gap-2">
            {t("time")}
            <span className="text-black/40 normal-case">
              ·{" "}
              {scheduleSource === "live"
                ? "Live availability"
                : "Demo schedule"}
            </span>
          </legend>
          {timeOptions.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {timeOptions.map((time) => (
                <label
                  key={time}
                  className="has-checked:border-wine has-checked:bg-wine cursor-pointer border border-black/20 py-3 text-center text-xs has-checked:text-white"
                >
                  <input
                    type="radio"
                    name="time"
                    value={time}
                    checked={selectedTime === time}
                    onChange={() => setSelectedTime(time)}
                    className="sr-only"
                  />
                  {time}
                </label>
              ))}
            </div>
          ) : (
            <p className="border border-black/15 p-4 text-sm text-black/55">
              No times remain on this date. Please choose another day.
            </p>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("name")} name="name" autoComplete="name" required />
          <Field
            label={t("email")}
            name="email"
            type="email"
            autoComplete="email"
          />
          <Field
            label={t("phone")}
            name="phone"
            type="tel"
            autoComplete="tel"
          />
          <label>
            <span className="field-label">{t("contactMethod")}</span>
            <select name="contactMethod" className="field" defaultValue="email">
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </label>
        </div>

        <label>
          <span className="field-label">{t("notes")}</span>
          <textarea
            name="notes"
            className="field min-h-32 resize-y"
            maxLength={1000}
          />
        </label>

        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            name="consent"
            type="checkbox"
            required
            className="accent-wine mt-1 size-4"
          />
          <span>{t("consent")}</span>
        </label>
      </div>

      <aside className="bg-porcelain h-fit border border-black/15 p-7 lg:sticky lg:top-28">
        <CalendarDays className="text-wine" size={24} strokeWidth={1.5} />
        <h2 className="display mt-5 text-3xl">
          {localize(selectedService.name, locale)}
        </h2>
        <p className="mt-3 text-sm leading-6 text-black/55">
          {localize(selectedService.description, locale)}
        </p>
        <dl className="mt-6 space-y-3 border-y border-black/15 py-5 text-sm">
          <div className="flex justify-between">
            <dt>Duration</dt>
            <dd>
              {minutesToDuration(selectedService.durationMinutes, locale)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Price</dt>
            <dd>{formatMoney(selectedService.price, locale)}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs leading-5 text-black/50">{t("policy")}</p>
        <button
          type="submit"
          disabled={status === "loading"}
          className="button-primary mt-6 w-full disabled:opacity-60"
        >
          <CheckCircle2 size={16} />
          {status === "loading" ? "Checking…" : t("confirm")}
        </button>
        {status === "error" && (
          <p className="text-wine mt-4 text-sm" role="alert">
            {error}
          </p>
        )}
      </aside>
    </form>
  );
}

function WorkerAvailabilityGrid({
  schedule,
  selectedArtist,
  selectedTime,
  onSelect,
}: {
  schedule: Array<{
    artistId: string;
    label: string;
    slots: Array<{ time: string; state: "open" | "busy" | "off" }>;
  }>;
  selectedArtist: string;
  selectedTime: string;
  onSelect: (artistId: string, time: string) => void;
}) {
  const t = useTranslations("Booking");
  if (!schedule.length) {
    return (
      <div className="border border-black/15 p-5 text-sm text-black/45">
        {t("scheduleLoading")}
      </div>
    );
  }
  const times = schedule[0]?.slots.map((slot) => slot.time) ?? [];

  return (
    <div className="bg-porcelain overflow-x-auto border border-black/15">
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `5rem repeat(${schedule.length}, minmax(8rem, 1fr))`,
        }}
      >
        <div className="bg-ink text-paper sticky left-0 z-10 border-r border-b border-black/10 p-3" />
        {schedule.map((worker) => (
          <div
            key={worker.artistId}
            className="bg-ink text-paper border-r border-b border-black/10 p-3 text-center text-xs font-bold tracking-wider uppercase"
          >
            {worker.label}
          </div>
        ))}
        {times.flatMap((time, rowIndex) => [
          <div
            key={`time-${time}`}
            className="bg-paper sticky left-0 z-10 border-r border-b border-black/10 p-3 text-xs font-bold"
          >
            {time}
          </div>,
          ...schedule.map((worker) => {
            const slot = worker.slots[rowIndex];
            const selected =
              worker.artistId === selectedArtist && time === selectedTime;
            return (
              <button
                type="button"
                key={`${worker.artistId}-${time}`}
                disabled={slot?.state !== "open"}
                onClick={() => onSelect(worker.artistId, time)}
                aria-label={`${worker.label} ${time} ${t(
                  slot?.state === "open"
                    ? "slotOpen"
                    : slot?.state === "busy"
                      ? "slotBusy"
                      : "slotOff",
                )}`}
                className={`min-h-11 border-r border-b border-black/10 px-3 py-2 text-[0.65rem] font-bold tracking-wider uppercase transition-colors ${
                  selected
                    ? "bg-wine text-white"
                    : slot?.state === "open"
                      ? "bg-acid/55 hover:bg-acid"
                      : slot?.state === "busy"
                        ? "bg-wine/12 text-wine"
                        : "bg-paper-deep text-black/30"
                }`}
              >
                {t(
                  slot?.state === "open"
                    ? "slotOpen"
                    : slot?.state === "busy"
                      ? "slotBusy"
                      : "slotOff",
                )}
              </button>
            );
          }),
        ])}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input
        className="field"
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
  );
}

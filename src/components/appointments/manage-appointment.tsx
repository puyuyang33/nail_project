"use client";

import { useEffect, useState } from "react";

type AppointmentDetails = {
  confirmationNumber: string;
  service: string;
  startsAt: string;
  timezone: string;
  status: string;
};

export function ManageAppointment({ token }: { token: string }) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "cancelled" | "error"
  >("idle");
  const [details, setDetails] = useState<AppointmentDetails | null>();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/appointments/manage/${token}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setDetails(null);
          return;
        }
        setDetails((await response.json()) as AppointmentDetails);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDetails(null);
        }
      });
    return () => controller.abort();
  }, [token]);

  async function cancel() {
    setStatus("loading");
    const response = await fetch(`/api/appointments/manage/${token}`, {
      method: "DELETE",
    });
    setStatus(response.ok ? "cancelled" : "error");
  }

  return (
    <div className="bg-porcelain border border-black/15 p-8">
      {details === undefined && (
        <p className="text-sm text-black/50">Verifying secure link…</p>
      )}
      {details === null && (
        <p className="text-wine text-sm" role="alert">
          This link is invalid or expired.
        </p>
      )}
      {details && (
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="field-label">Reference</dt>
            <dd>{details.confirmationNumber}</dd>
          </div>
          <div>
            <dt className="field-label">Status</dt>
            <dd>{details.status.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="field-label">Service</dt>
            <dd>{details.service}</dd>
          </div>
          <div>
            <dt className="field-label">Start</dt>
            <dd>{new Date(details.startsAt).toLocaleString()}</dd>
          </div>
        </dl>
      )}
      <p className="mt-6 text-xs leading-5 text-black/45">
        Contact information is never included in this URL.
      </p>
      {status === "cancelled" ? (
        <p className="text-wine mt-6 font-bold">Appointment cancelled.</p>
      ) : (
        <button
          type="button"
          className="button-secondary mt-6"
          disabled={status === "loading" || !details}
          onClick={cancel}
        >
          {status === "loading" ? "Cancelling…" : "Cancel appointment"}
        </button>
      )}
      {status === "error" && (
        <p className="text-wine mt-4 text-sm" role="alert">
          This link is invalid, expired, or the appointment can no longer be
          changed online.
        </p>
      )}
    </div>
  );
}

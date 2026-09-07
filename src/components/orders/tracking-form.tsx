"use client";

import { Search } from "lucide-react";
import { useState } from "react";

type TrackingResult = {
  orderNumber: string;
  status: string;
  updatedAt: string;
  trackingUrl?: string;
};

export function TrackingForm() {
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/orders/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const body = (await response.json()) as TrackingResult & { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "We could not find that order.");
      return;
    }
    setResult(body);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={submit}
        className="bg-porcelain border border-black/15 p-7"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            <span className="field-label">Order number</span>
            <input
              className="field"
              name="orderNumber"
              placeholder="LUN-240001"
              required
            />
          </label>
          <label>
            <span className="field-label">Email or phone</span>
            <input className="field" name="contact" required />
          </label>
        </div>
        <button className="button-primary mt-6" disabled={loading}>
          <Search size={16} /> {loading ? "Searching…" : "Track order"}
        </button>
        {error && (
          <p className="text-wine mt-4 text-sm" role="alert">
            {error}
          </p>
        )}
      </form>
      {result && (
        <div className="border-wine bg-wine text-paper mt-6 border p-7">
          <p className="eyebrow text-acid">{result.orderNumber}</p>
          <p className="display mt-4 text-4xl">{result.status}</p>
          <p className="text-paper/65 mt-3 text-sm">
            Updated {new Date(result.updatedAt).toLocaleString()}
          </p>
          {result.trackingUrl && (
            <a
              className="button-secondary border-paper text-paper mt-6"
              href={result.trackingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Carrier details
            </a>
          )}
        </div>
      )}
    </div>
  );
}

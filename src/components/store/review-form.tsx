"use client";

import { useState } from "react";

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(form.entries()),
        productSlug,
      }),
    });
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? "The review could not be submitted.");
      return;
    }
    event.currentTarget.reset();
    setStatus("success");
    setMessage(
      body.message ?? "Thank you. Your review is awaiting moderation.",
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label>
          <span className="field-label">Name</span>
          <input className="field" name="name" required />
        </label>
        <label>
          <span className="field-label">Email</span>
          <input className="field" name="email" type="email" required />
        </label>
        <label>
          <span className="field-label">Rating</span>
          <select className="field" name="rating" defaultValue="5">
            {[5, 4, 3, 2, 1].map((rating) => (
              <option value={rating} key={rating}>
                {rating} / 5
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="field-label">Review title</span>
        <input className="field" name="title" maxLength={120} />
      </label>
      <label>
        <span className="field-label">Your review</span>
        <textarea
          className="field min-h-28"
          name="body"
          minLength={10}
          maxLength={1500}
          required
        />
      </label>
      <button
        className="button-secondary w-fit"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Submitting…" : "Submit for review"}
      </button>
      <p
        className={`min-h-5 text-sm ${status === "error" ? "text-wine" : "text-black/55"}`}
        role="status"
      >
        {message}
      </p>
    </form>
  );
}

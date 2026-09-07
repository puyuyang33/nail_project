"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

export function InquiryForm({ type }: { type: "contact" | "wholesale" }) {
  const t = useTranslations("Forms");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const data = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, type }),
    });
    setStatus(response.ok ? "success" : "error");
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form
      onSubmit={submit}
      className="bg-porcelain border border-black/15 p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("name")} name="name" required />
        <Field label={t("email")} name="email" type="email" required />
        {type === "wholesale" ? (
          <>
            <Field label={t("company")} name="company" required />
            <Field label={t("website")} name="website" type="url" />
          </>
        ) : (
          <Field label={t("phone")} name="phone" type="tel" />
        )}
      </div>
      <label className="mt-5 block">
        <span className="field-label">{t("message")}</span>
        <textarea
          className="field min-h-36 resize-y"
          name="message"
          required
          minLength={10}
          maxLength={2000}
        />
      </label>
      <button
        className="button-primary mt-6"
        type="submit"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Sending…" : t("send")}
      </button>
      <p
        className={`mt-4 min-h-5 text-sm ${
          status === "error" ? "text-wine" : "text-black/60"
        }`}
        role="status"
      >
        {status === "success" ? t("success") : ""}
        {status === "error" ? t("error") : ""}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input className="field" name={name} type={type} required={required} />
    </label>
  );
}

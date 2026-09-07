"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { Locale } from "@/i18n/routing";

export function NewsletterForm() {
  const t = useTranslations("Forms");
  const locale = useLocale() as Locale;
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), locale }),
    });
    setStatus(response.ok ? "success" : "error");
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form className="mt-6" onSubmit={submit}>
      <label className="sr-only" htmlFor="newsletter-email">
        {t("email")}
      </label>
      <div className="flex border-b border-current">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("email")}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-current/55"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="grid size-12 place-items-center"
          aria-label={t("subscribe")}
        >
          <ArrowRight aria-hidden="true" size={19} />
        </button>
      </div>
      <p className="mt-3 min-h-5 text-xs" aria-live="polite">
        {status === "success" ? t("success") : ""}
        {status === "error" ? t("error") : ""}
      </p>
    </form>
  );
}

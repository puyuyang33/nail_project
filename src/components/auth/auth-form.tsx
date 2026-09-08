"use client";

import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthForm({
  mode,
  callbackUrl = "/account",
  resetToken,
  allowRegistration = false,
}: {
  mode: Mode;
  callbackUrl?: string;
  resetToken?: string;
  allowRegistration?: boolean;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("Auth");
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries());

    if (mode === "login") {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (result?.error) {
        setStatus("error");
        setMessage(t("incorrect"));
        return;
      }
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    const endpoint =
      mode === "register"
        ? "/api/register"
        : mode === "forgot"
          ? "/api/password/forgot"
          : "/api/password/reset";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, locale, token: resetToken }),
    });
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      setStatus("error");
      setMessage(body.error ?? t("unavailable"));
      return;
    }

    if (mode === "register") {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (result?.error) {
        setStatus("error");
        setMessage("Account created. Please sign in.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    setStatus("success");
    setMessage(
      body.message ??
        (mode === "forgot"
          ? "If that account exists, a secure reset link is on its way."
          : "Password updated. You can now sign in."),
    );
  }

  const copy = {
    login: {
      eyebrow: t("welcome"),
      title: t("loginTitle"),
      button: t("login"),
    },
    register: {
      eyebrow: t("account"),
      title: t("registerTitle"),
      button: t("register"),
    },
    forgot: {
      eyebrow: t("recovery"),
      title: t("forgotTitle"),
      button: t("sendLink"),
    },
    reset: {
      eyebrow: t("newPassword"),
      title: t("resetTitle"),
      button: t("updatePassword"),
    },
  }[mode];

  return (
    <div className="mx-auto w-full max-w-lg">
      <p className="eyebrow text-wine">{copy.eyebrow}</p>
      <h1 className="display mt-5 text-6xl leading-[0.9] tracking-[-0.05em]">
        {copy.title}
      </h1>
      <form onSubmit={submit} className="mt-10 space-y-5">
        {mode === "register" && (
          <Field
            label={t("fullName")}
            name="name"
            autoComplete="name"
            required
          />
        )}
        {mode !== "reset" && (
          <Field
            label={t("email")}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        )}
        {(mode === "login" || mode === "register" || mode === "reset") && (
          <Field
            label={mode === "reset" ? t("newPassword") : t("password")}
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={12}
            required
          />
        )}
        {mode === "register" && (
          <p className="text-xs leading-5 text-black/50">{t("passwordHint")}</p>
        )}
        <button
          type="submit"
          disabled={status === "loading"}
          className="button-primary w-full disabled:opacity-60"
        >
          {status === "loading" ? t("working") : copy.button}
        </button>
        <p
          className={`min-h-6 text-sm ${
            status === "error" ? "text-wine" : "text-black/60"
          }`}
          role="status"
        >
          {message}
        </p>
      </form>
      {mode === "login" && (
        <div
          className={`mt-6 flex text-xs ${
            allowRegistration ? "justify-between" : "justify-end"
          }`}
        >
          {allowRegistration && (
            <Link href="/register" className="underline underline-offset-4">
              {t("createLink")}
            </Link>
          )}
          <Link
            href="/forgot-password"
            className="underline underline-offset-4"
          >
            {t("forgotLink")}
          </Link>
        </div>
      )}
      {mode !== "login" && (
        <Link
          href="/login"
          className="mt-6 inline-block text-xs underline underline-offset-4"
        >
          {t("returnLogin")}
        </Link>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  minLength,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        className="field"
        type={type}
        name={name}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
      />
    </label>
  );
}

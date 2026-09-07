"use client";

import { CheckCircle2, LockKeyhole } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { storeConfig } from "@/config/store";
import { formatMoney } from "@/lib/utils";
import { useStore } from "@/components/store/store-provider";

type CheckoutStatus =
  { type: "idle" } | { type: "loading" } | { type: "error"; message: string };

export function CheckoutForm() {
  const locale = useLocale() as Locale;
  const t = useTranslations("Checkout");
  const { cart, subtotal, hydrated } = useStore();
  const [shippingId, setShippingId] = useState<string>(
    storeConfig.shippingMethods[0].id,
  );
  const [status, setStatus] = useState<CheckoutStatus>({ type: "idle" });
  const shipping = useMemo(
    () =>
      storeConfig.shippingMethods.find((method) => method.id === shippingId) ??
      storeConfig.shippingMethods[0],
    [shippingId],
  );

  if (!hydrated) {
    return <div className="bg-paper-deep/50 min-h-96 animate-pulse" />;
  }

  if (!cart.length) {
    return (
      <div className="bg-porcelain border border-black/15 p-8 text-center">
        {t("empty")}
      </div>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "loading" });
    const form = new FormData(event.currentTarget);
    const payload = {
      locale,
      email: form.get("email"),
      phone: form.get("phone"),
      name: form.get("name"),
      address: {
        line1: form.get("line1"),
        line2: form.get("line2"),
        city: form.get("city"),
        region: form.get("region"),
        postalCode: form.get("postalCode"),
        country: form.get("country"),
      },
      shippingMethodId: shippingId,
      discountCode: form.get("discountCode"),
      items: cart.map((line) => ({
        productSlug: line.slug,
        quantity: line.quantity,
        shape: line.shape,
        size: line.size,
        finish: line.finish,
        customSizing: line.customSizing,
      })),
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      setStatus({
        type: "error",
        message: body.error ?? "Checkout could not be started.",
      });
      return;
    }
    window.location.assign(body.url);
  }

  return (
    <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_23rem]">
      <div className="space-y-10">
        <fieldset>
          <legend className="display text-3xl">{t("contact")}</legend>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label={t("fullName")}
              name="name"
              autoComplete="name"
              required
            />
            <Field
              label={t("email")}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Field
              label={t("phone")}
              name="phone"
              type="tel"
              autoComplete="tel"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="display text-3xl">{t("shippingAddress")}</legend>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label={t("street")}
                name="line1"
                autoComplete="address-line1"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Field
                label={t("line2")}
                name="line2"
                autoComplete="address-line2"
              />
            </div>
            <Field
              label={t("city")}
              name="city"
              autoComplete="address-level2"
              required
            />
            <Field
              label={t("region")}
              name="region"
              autoComplete="address-level1"
              required
            />
            <Field
              label={t("postalCode")}
              name="postalCode"
              autoComplete="postal-code"
              required
            />
            <label>
              <span className="field-label">{t("country")}</span>
              <select
                className="field"
                name="country"
                autoComplete="country"
                required
                defaultValue="US"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="display text-3xl">{t("delivery")}</legend>
          <div className="mt-5 divide-y divide-black/15 border-y border-black/15">
            {storeConfig.shippingMethods.map((method) => (
              <label
                key={method.id}
                className="flex cursor-pointer items-center gap-4 py-5"
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={method.id}
                  checked={shippingId === method.id}
                  onChange={() => setShippingId(method.id)}
                  className="accent-wine"
                />
                <span className="flex-1">
                  <span className="font-bold">{method.label}</span>
                  <span className="mt-1 block text-xs text-black/48">
                    {method.eta}
                  </span>
                </span>
                <span className="text-sm">
                  {method.price
                    ? formatMoney(method.price, locale)
                    : t("complimentary")}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          <span className="field-label">{t("discountCode")}</span>
          <input
            className="field max-w-sm uppercase"
            name="discountCode"
            autoComplete="off"
            maxLength={50}
          />
        </label>
      </div>

      <aside className="bg-porcelain h-fit border border-black/15 p-7 lg:sticky lg:top-28">
        <h2 className="display text-3xl">{t("summary")}</h2>
        <ul className="mt-6 space-y-4">
          {cart.map((line) => (
            <li
              key={line.lineId}
              className="flex justify-between gap-3 text-sm"
            >
              <span>
                {line.name}{" "}
                <span className="text-black/45">× {line.quantity}</span>
              </span>
              <span>{formatMoney(line.price * line.quantity, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-6 space-y-3 border-t border-black/15 pt-5 text-sm">
          <div className="flex justify-between">
            <dt>{t("subtotal")}</dt>
            <dd>{formatMoney(subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{t("shipping")}</dt>
            <dd>{formatMoney(shipping.price, locale)}</dd>
          </div>
          <div className="flex justify-between border-t border-black/15 pt-4 font-bold">
            <dt>{t("total")}</dt>
            <dd>{formatMoney(subtotal + shipping.price, locale)}</dd>
          </div>
        </dl>
        <button
          type="submit"
          disabled={status.type === "loading"}
          className="button-primary mt-7 w-full disabled:cursor-wait disabled:opacity-60"
        >
          <LockKeyhole size={16} />
          {status.type === "loading" ? t("paying") : t("pay")}
        </button>
        <p className="mt-4 flex items-start gap-2 text-[0.7rem] leading-5 text-black/48">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          {t("priceNotice")}
        </p>
        {status.type === "error" && (
          <p className="text-wine mt-4 text-sm" role="alert">
            {status.message}
          </p>
        )}
      </aside>
    </form>
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

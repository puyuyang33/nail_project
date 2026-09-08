"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function GoogleSignInButton({
  callbackUrl,
  configured,
}: {
  callbackUrl: string;
  configured: boolean;
}) {
  const t = useTranslations("Auth");
  const [pending, setPending] = useState(false);

  return (
    <div>
      <button
        type="button"
        disabled={!configured || pending}
        onClick={() => {
          setPending(true);
          void signIn("google", { redirectTo: callbackUrl });
        }}
        className="border-ink bg-porcelain hover:bg-acid flex min-h-14 w-full items-center justify-center gap-3 border px-5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-white font-sans text-base text-[#4285f4] shadow-sm"
        >
          G
        </span>
        {pending ? t("working") : t("continueGoogle")}
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-black/48">
        {configured ? t("googlePrivacy") : t("googleNotConfigured")}
      </p>
    </div>
  );
}

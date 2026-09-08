import { AuthForm } from "@/components/auth/auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { env, serviceReadiness } from "@/lib/env";
import { getTranslations } from "next-intl/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/[locale]/login">) {
  const query = (await searchParams) as {
    callbackUrl?: string;
    error?: string;
  };
  const t = await getTranslations("Auth");
  const safeCallback =
    query.callbackUrl?.startsWith("/") && !query.callbackUrl.startsWith("//")
      ? query.callbackUrl
      : "/account";

  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <p className="eyebrow text-wine">{t("googleEyebrow")}</p>
          <h1 className="display mt-5 text-6xl leading-[0.9] tracking-[-0.05em]">
            {t("googleTitle")}
          </h1>
        </div>
        <div className="mt-10">
          <GoogleSignInButton
            callbackUrl={safeCallback}
            configured={serviceReadiness.googleAuth}
          />
          {query.error && (
            <p className="text-wine mt-4 text-center text-sm" role="alert">
              {t("googleError")}
            </p>
          )}
        </div>
        {env.AUTH_CREDENTIALS_ENABLED && (
          <>
            <div className="my-9 flex items-center gap-4">
              <span className="h-px flex-1 bg-black/15" />
              <span className="eyebrow text-black/35">
                {t("passwordFallback")}
              </span>
              <span className="h-px flex-1 bg-black/15" />
            </div>
            <AuthForm
              mode="login"
              callbackUrl={safeCallback}
              allowRegistration={env.AUTH_PASSWORD_REGISTRATION_ENABLED}
            />
          </>
        )}
      </div>
    </div>
  );
}

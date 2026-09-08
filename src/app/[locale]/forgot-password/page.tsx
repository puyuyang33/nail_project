import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { env } from "@/lib/env";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  if (!env.AUTH_CREDENTIALS_ENABLED) {
    redirect(`/${locale}/login`);
  }
  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <AuthForm mode="forgot" />
    </div>
  );
}

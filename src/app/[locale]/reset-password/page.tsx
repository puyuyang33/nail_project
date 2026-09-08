import { AuthForm } from "@/components/auth/auth-form";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  if (!env.AUTH_CREDENTIALS_ENABLED) {
    redirect(`/${locale}/login`);
  }
  const query = (await searchParams) as { token?: string };
  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <AuthForm mode="reset" resetToken={query.token} />
    </div>
  );
}

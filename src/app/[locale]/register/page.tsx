import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { env } from "@/lib/env";

export const metadata = { title: "Create an account" };

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  if (!env.AUTH_PASSWORD_REGISTRATION_ENABLED) {
    redirect(`/${locale}/login`);
  }
  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <AuthForm mode="register" />
    </div>
  );
}

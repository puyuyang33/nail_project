import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const query = (await searchParams) as { token?: string };
  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <AuthForm mode="reset" resetToken={query.token} />
    </div>
  );
}

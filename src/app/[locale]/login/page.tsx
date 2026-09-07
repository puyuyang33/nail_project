import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/[locale]/login">) {
  const query = (await searchParams) as { callbackUrl?: string };
  const safeCallback =
    query.callbackUrl?.startsWith("/") && !query.callbackUrl.startsWith("//")
      ? query.callbackUrl
      : "/account";

  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <AuthForm mode="login" callbackUrl={safeCallback} />
    </div>
  );
}

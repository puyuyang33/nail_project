import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="editorial-grid grid min-h-[calc(100svh-6.5rem)] place-items-center px-5 py-16">
      <AuthForm mode="forgot" />
    </div>
  );
}

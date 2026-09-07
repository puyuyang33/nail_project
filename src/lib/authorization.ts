import "server-only";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Locale } from "@/i18n/routing";

const adminRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

export async function getCurrentUser() {
  return (await auth())?.user ?? null;
}

export async function requireUser(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

export async function requireAdmin(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?callbackUrl=/${locale}/admin`);
  if (!adminRoles.has(user.role)) redirect(`/${locale}/account`);
  return user;
}

export function isAdminRole(role: UserRole) {
  return adminRoles.has(role);
}

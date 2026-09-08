import { redirect } from "next/navigation";

export default async function AdminAppointmentsRedirect({
  params,
}: PageProps<"/[locale]/admin/appointments">) {
  const { locale } = await params;
  redirect(`/${locale}/admin/calendar`);
}

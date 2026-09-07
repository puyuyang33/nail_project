import { ManageAppointment } from "@/components/appointments/manage-appointment";

export default async function ManageAppointmentPage({
  params,
}: PageProps<"/[locale]/appointments/manage/[token]">) {
  const { token } = await params;
  return (
    <div className="container-shell mx-auto max-w-2xl py-16 md:py-24">
      <p className="eyebrow text-wine">Private booking link</p>
      <h1 className="display mt-5 text-6xl">Manage appointment</h1>
      <div className="mt-9">
        <ManageAppointment token={token} />
      </div>
    </div>
  );
}

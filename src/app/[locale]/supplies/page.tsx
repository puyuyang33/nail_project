import { redirect } from "@/i18n/navigation";

export default async function SuppliesPage({
  params,
}: PageProps<"/[locale]/supplies">) {
  const { locale } = await params;
  redirect({ href: "/shop?category=supplies", locale });
}

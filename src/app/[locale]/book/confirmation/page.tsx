import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function BookingConfirmationPage({
  searchParams,
}: PageProps<"/[locale]/book/confirmation">) {
  const query = (await searchParams) as { reference?: string };
  const t = await getTranslations("Booking");

  return (
    <div className="container-shell grid min-h-[38rem] place-items-center py-16 text-center">
      <div className="max-w-xl">
        <CheckCircle2
          className="text-wine mx-auto"
          size={44}
          strokeWidth={1.3}
        />
        <h1 className="display mt-6 text-6xl">{t("successTitle")}</h1>
        <p className="mt-5 leading-7 text-black/58">{t("successBody")}</p>
        {query.reference && (
          <p className="eyebrow mt-6 border-y border-black/15 py-4">
            Reference {query.reference}
          </p>
        )}
        <Link href="/" className="button-primary mt-8">
          Return home
        </Link>
      </div>
    </div>
  );
}

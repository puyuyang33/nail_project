import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function OrderConfirmationPage({
  searchParams,
}: PageProps<"/[locale]/orders/confirmation">) {
  const query = (await searchParams) as { order?: string };
  return (
    <div className="container-shell grid min-h-[38rem] place-items-center py-16 text-center">
      <div className="max-w-xl">
        <CheckCircle2
          className="text-wine mx-auto"
          size={44}
          strokeWidth={1.3}
        />
        <p className="eyebrow text-wine mt-6">Payment received</p>
        <h1 className="display mt-4 text-6xl">Your order is in the atelier.</h1>
        <p className="mt-5 leading-7 text-black/58">
          We sent a receipt and will share tracking as soon as your objects
          leave the studio.
        </p>
        {query.order && (
          <p className="eyebrow mt-6 border-y border-black/15 py-4">
            Order {query.order}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="button-primary">
            Continue exploring
          </Link>
          <Link href="/login" className="button-secondary">
            Continue with Google
          </Link>
        </div>
      </div>
    </div>
  );
}

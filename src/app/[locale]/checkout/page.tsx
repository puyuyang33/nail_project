import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const t = await getTranslations("Checkout");
  return (
    <div className="container-shell py-12 md:py-20">
      <header className="mb-10">
        <p className="eyebrow text-wine">{t("eyebrow")}</p>
        <h1 className="display mt-4 text-6xl tracking-[-0.05em]">
          {t("title")}
        </h1>
      </header>
      <CheckoutForm />
    </div>
  );
}

import { TrackingForm } from "@/components/orders/tracking-form";

export const metadata = { title: "Track an order" };

export default function TrackOrderPage() {
  return (
    <div className="container-shell py-16 md:py-24">
      <header className="mx-auto mb-10 max-w-2xl text-center">
        <p className="eyebrow text-wine">From atelier to doorstep</p>
        <h1 className="display mt-5 text-6xl tracking-[-0.05em] md:text-8xl">
          Track your order
        </h1>
        <p className="mt-5 text-black/58">
          Enter the order number from your confirmation and the email or phone
          used at checkout.
        </p>
      </header>
      <TrackingForm />
    </div>
  );
}

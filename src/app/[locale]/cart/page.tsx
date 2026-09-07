import { CartView } from "@/components/store/cart-view";

export const metadata = {
  title: "Shopping bag",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="container-shell py-12 md:py-20">
      <CartView />
    </div>
  );
}

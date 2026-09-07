import { WishlistView } from "@/components/account/wishlist-view";

export default function WishlistPage() {
  return (
    <div className="container-shell py-14 md:py-24">
      <p className="eyebrow text-wine">Saved locally and in your account</p>
      <h1 className="display mt-5 text-7xl tracking-[-0.05em]">Wishlist</h1>
      <div className="mt-12">
        <WishlistView />
      </div>
    </div>
  );
}

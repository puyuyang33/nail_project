import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <div className="editorial-grid grid min-h-[36rem] place-items-center px-6 py-20 text-center">
      <div>
        <p className="display text-wine/15 text-[9rem] leading-none">404</p>
        <h1 className="display -mt-8 text-5xl">This object has moved.</h1>
        <p className="mt-4 text-black/55">
          Return to the atelier and find something new.
        </p>
        <Link href="/" className="button-primary mt-8">
          Return home
        </Link>
      </div>
    </div>
  );
}

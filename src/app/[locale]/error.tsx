"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[34rem] place-items-center px-6 text-center">
      <div>
        <p className="eyebrow text-wine">A studio interruption</p>
        <h1 className="display mt-5 text-5xl">Something slipped.</h1>
        <p className="mt-4 text-black/55">
          Your information is safe. Please try the last step again.
        </p>
        <button type="button" onClick={reset} className="button-primary mt-8">
          Try again
        </button>
      </div>
    </div>
  );
}

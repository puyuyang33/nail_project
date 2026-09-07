"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ProductImage } from "@/types/catalog";
import type { Locale } from "@/i18n/routing";
import { localize } from "@/lib/utils";

export function ProductGallery({
  images,
  locale,
}: {
  images: ProductImage[];
  locale: Locale;
}) {
  const t = useTranslations("Product");
  const [selected, setSelected] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = images[selected];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <div className="order-2 flex gap-2 sm:order-1 sm:flex-col">
          {images.map((image, index) => (
            <button
              type="button"
              key={image.src}
              onClick={() => setSelected(index)}
              className={`relative aspect-[4/5] w-16 overflow-hidden border sm:w-full ${
                selected === index ? "border-ink" : "border-transparent"
              }`}
              aria-label={t("selectImage", { number: index + 1 })}
              aria-pressed={selected === index}
            >
              <Image
                src={image.src}
                alt=""
                fill
                loading={index === 0 ? "eager" : "lazy"}
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="group bg-paper-deep relative order-1 aspect-[4/5] overflow-hidden sm:order-2"
          aria-label={t("zoom")}
        >
          <Image
            src={current.src}
            alt={localize(current.alt, locale)}
            fill
            loading="eager"
            sizes="(min-width: 1024px) 52vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <span className="bg-paper text-ink absolute right-4 bottom-4 grid size-11 place-items-center shadow-lg">
            <Maximize2 aria-hidden="true" size={17} />
          </span>
        </button>
      </div>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("zoom")}
          className="bg-ink/95 fixed inset-0 z-[80] grid place-items-center p-4"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute top-5 right-5 border border-white/30 px-4 py-2 text-xs font-bold tracking-wider text-white uppercase"
          >
            Close
          </button>
          <div className="relative h-[85vh] w-full max-w-5xl">
            <Image
              src={current.src}
              alt={localize(current.alt, locale)}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

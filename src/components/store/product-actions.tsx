"use client";

import { Check, Heart, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Product } from "@/types/catalog";
import { cn } from "@/lib/utils";
import { useStore } from "./store-provider";

type ProductActionsProps = {
  product: Product;
  localizedName: string;
  compact?: boolean;
};

export function ProductActions({
  product,
  localizedName,
  compact = false,
}: ProductActionsProps) {
  const t = useTranslations("Common");
  const productT = useTranslations("Product");
  const cartT = useTranslations("Cart");
  const { addItem, toggleWishlist, wishlist } = useStore();
  const [added, setAdded] = useState(false);
  const [shape, setShape] = useState(product.shapes[0]);
  const [size, setSize] = useState(product.sizes[0]);
  const [finish, setFinish] = useState(product.finishes[0]);
  const [customSizing, setCustomSizing] = useState("");
  const wished = wishlist.includes(product.id);

  const add = () => {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: localizedName,
      image: product.images[0].src,
      price: product.price,
      quantity: 1,
      shape,
      size,
      finish,
      customSizing: size === "Custom" ? customSizing : undefined,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  if (compact) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={
            product.stock < 1 || (size === "Custom" && !customSizing.trim())
          }
          className="border-ink bg-paper hover:bg-acid grid size-11 place-items-center border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("addToCart")}
        >
          {added ? <Check size={17} /> : <ShoppingBag size={17} />}
        </button>
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          className={cn(
            "border-ink hover:bg-wine grid size-11 place-items-center border transition-colors hover:text-white",
            wished && "bg-wine text-white",
          )}
          aria-label={
            wished ? productT("wishlistRemove") : productT("wishlistAdd")
          }
          aria-pressed={wished}
        >
          <Heart size={17} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-3">
        <OptionSelect
          label={productT("shape")}
          value={shape}
          options={product.shapes}
          onChange={setShape}
        />
        <OptionSelect
          label={productT("size")}
          value={size}
          options={product.sizes}
          onChange={setSize}
        />
        <OptionSelect
          label={productT("finish")}
          value={finish}
          options={product.finishes}
          onChange={setFinish}
        />
      </div>
      {size === "Custom" && (
        <label className="mt-5 block">
          <span className="field-label">{productT("customMeasurements")}</span>
          <input
            className="field"
            value={customSizing}
            onChange={(event) => setCustomSizing(event.target.value)}
            placeholder="15, 11, 12, 10, 8 / 15, 11, 12, 10, 8"
            required
          />
        </label>
      )}
      <div className="mt-6 grid grid-cols-[1fr_auto] gap-3">
        <button
          type="button"
          onClick={add}
          disabled={
            product.stock < 1 || (size === "Custom" && !customSizing.trim())
          }
          className="button-primary"
        >
          {added ? (
            <>
              <Check size={17} /> {cartT("added")}
            </>
          ) : (
            <>
              <ShoppingBag size={17} /> {t("addToCart")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          className={cn(
            "border-ink hover:bg-wine grid size-12 place-items-center border hover:text-white",
            wished && "bg-wine text-white",
          )}
          aria-label={
            wished ? productT("wishlistRemove") : productT("wishlistAdd")
          }
          aria-pressed={wished}
        >
          <Heart size={18} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

function OptionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <select
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

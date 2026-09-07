"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

type ManagedImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  altText: string;
  altTextZh: string;
  isPrimary: boolean;
};

export function ImageManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ManagedImage[]>([]);
  const [status, setStatus] = useState("");

  async function upload(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.type,
      )
    ) {
      setStatus("Use a JPEG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size > 4_000_000) {
      setStatus("Images must be smaller than 4 MB.");
      return;
    }
    setStatus("Uploading securely…");
    const data = new FormData();
    data.set("file", file);
    const response = await fetch("/api/admin/cloudinary/upload", {
      method: "POST",
      body: data,
    });
    const result = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      width?: number;
      height?: number;
      error?: { message?: string };
    };
    if (
      !response.ok ||
      !result.secure_url ||
      !result.public_id ||
      !result.width ||
      !result.height
    ) {
      setStatus(result.error?.message ?? "Cloudinary upload failed.");
      return;
    }
    setImages((current) => [
      ...current,
      {
        url: result.secure_url!,
        publicId: result.public_id!,
        width: result.width!,
        height: result.height!,
        altText: "",
        altTextZh: "",
        isPrimary: current.length === 0,
      },
    ]);
    setStatus("Upload complete.");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(index: number) {
    const image = images[index];
    const response = await fetch("/api/admin/cloudinary/signature", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicId: image.publicId }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setStatus(result.error ?? "Image could not be removed.");
      return;
    }
    setImages((current) => {
      const next = current.filter((_, imageIndex) => imageIndex !== index);
      if (image.isPrimary && next[0]) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  }

  function move(index: number, direction: -1 | 1) {
    setImages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function update(index: number, patch: Partial<ManagedImage>) {
    setImages((current) =>
      current.map((image, imageIndex) => {
        if ("isPrimary" in patch && patch.isPrimary) {
          return imageIndex === index
            ? { ...image, ...patch }
            : { ...image, isPrimary: false };
        }
        return imageIndex === index ? { ...image, ...patch } : image;
      }),
    );
  }

  return (
    <div>
      <input type="hidden" name="imagesJson" value={JSON.stringify(images)} />
      <div className="space-y-4">
        {images.map((image, index) => (
          <div
            key={image.publicId}
            className="grid gap-4 border border-black/15 p-4 sm:grid-cols-[7rem_1fr_auto]"
          >
            <div className="bg-paper-deep relative aspect-[4/5] overflow-hidden">
              <Image
                src={image.url}
                alt=""
                fill
                sizes="112px"
                className="object-cover"
              />
            </div>
            <div className="space-y-3">
              <input
                className="field"
                placeholder="English alternative text"
                value={image.altText}
                onChange={(event) =>
                  update(index, { altText: event.target.value })
                }
                required
              />
              <input
                className="field"
                placeholder="简体中文替代文字"
                value={image.altTextZh}
                onChange={(event) =>
                  update(index, { altTextZh: event.target.value })
                }
                required
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name="primaryImage"
                  checked={image.isPrimary}
                  onChange={() => update(index, { isPrimary: true })}
                />
                Primary image
              </label>
            </div>
            <div className="flex gap-2 sm:flex-col">
              <IconButton
                label="Move image up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} />
              </IconButton>
              <IconButton
                label="Move image down"
                disabled={index === images.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} />
              </IconButton>
              <IconButton
                label="Remove image"
                onClick={() => void remove(index)}
              >
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      <label className="hover:bg-paper-deep mt-4 flex cursor-pointer items-center justify-center gap-2 border border-dashed border-black/30 p-7 text-xs font-bold tracking-wider uppercase">
        <ImagePlus size={18} />
        Upload product image
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </label>
      <p className="mt-2 min-h-5 text-xs text-black/50" role="status">
        {status}
      </p>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center border border-black/15 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

import Image from "next/image";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { ImageManager } from "@/components/admin/image-manager";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { createCollection, updateCollection } from "../catalog-actions";

export default async function AdminCollectionsPage({
  params,
}: PageProps<"/[locale]/admin/collections">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const collections = await requireDatabase().collection.findMany({
    include: {
      translations: true,
      _count: { select: { products: true } },
    },
    orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow text-wine">Curated chapters</p>
          <h1 className="display mt-4 text-6xl">Collections</h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-black/50">
          Deactivation removes a collection from the storefront without deleting
          its products or history.
        </p>
      </div>

      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        {collections.map((collection) => {
          const english = collection.translations.find(
            (translation) => translation.locale === "en",
          );
          const chinese =
            collection.translations.find(
              (translation) => translation.locale === "zh",
            ) ?? english;
          return (
            <article
              key={collection.id}
              className="bg-porcelain grid overflow-hidden border border-black/15 sm:grid-cols-[9rem_1fr]"
            >
              <CollectionImage
                src={collection.imageUrl}
                alt={english?.name ?? collection.slug}
              />
              <div className="flex min-w-0 flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow text-black/40">
                      {collection._count.products}{" "}
                      {collection._count.products === 1
                        ? "product"
                        : "products"}
                    </p>
                    <h2 className="display mt-2 truncate text-3xl">
                      {english?.name ?? collection.slug}
                    </h2>
                    <p className="mt-1 truncate text-xs text-black/40">
                      {chinese?.name ?? collection.slug} · {collection.slug}
                    </p>
                  </div>
                  <Link
                    href={`/collections/${collection.slug}`}
                    className="shrink-0 text-xs font-bold underline underline-offset-4"
                  >
                    View
                  </Link>
                </div>
                <form
                  action={updateCollection}
                  className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6"
                >
                  <input type="hidden" name="locale" value={safeLocale} />
                  <input type="hidden" name="id" value={collection.id} />
                  <FlagCheckbox
                    name="isActive"
                    label="Active"
                    defaultChecked={collection.isActive}
                  />
                  <FlagCheckbox
                    name="isFeatured"
                    label="Featured"
                    defaultChecked={collection.isFeatured}
                  />
                  <div className="ml-auto flex gap-2">
                    <button
                      name="intent"
                      value="save"
                      className="border border-black/20 px-3 py-2 text-xs font-bold"
                    >
                      Save
                    </button>
                    <button
                      name="intent"
                      value="deactivate"
                      className="text-wine px-3 py-2 text-xs font-bold"
                    >
                      Deactivate
                    </button>
                  </div>
                </form>
              </div>
            </article>
          );
        })}
        {!collections.length && (
          <div className="bg-porcelain border border-black/15 p-7 text-sm text-black/45 xl:col-span-2">
            No collections yet.
          </div>
        )}
      </div>

      <section className="bg-porcelain mt-12 border border-black/15 p-6 md:p-8">
        <p className="eyebrow text-wine">New story</p>
        <h2 className="display mt-3 text-4xl">Create collection</h2>
        <form action={createCollection} className="mt-8 space-y-9">
          <input type="hidden" name="locale" value={safeLocale} />
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField
              label="URL slug"
              name="slug"
              placeholder="night-garden"
              maxLength={120}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
            <div className="grid grid-cols-2 gap-4">
              <FlagCheckbox name="isActive" label="Active" defaultChecked />
              <FlagCheckbox
                name="isFeatured"
                label="Featured"
                defaultChecked={false}
              />
            </div>
            <AdminField label="English name" name="nameEn" maxLength={160} />
            <AdminField label="中文名称" name="nameZh" maxLength={160} />
            <AdminTextarea
              label="English description"
              name="descriptionEn"
              minLength={5}
            />
            <AdminTextarea
              label="中文描述"
              name="descriptionZh"
              minLength={2}
            />
          </div>
          <div>
            <h3 className="field-label mb-2">Collection image</h3>
            <p className="mb-4 text-xs leading-5 text-black/50">
              Upload an image with bilingual alternative text. The primary
              upload becomes the collection cover.
            </p>
            <ImageManager />
          </div>
          <button className="button-primary">Create collection</button>
        </form>
      </section>
    </div>
  );
}

function CollectionImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="bg-paper-deep grid min-h-36 place-items-center text-3xl text-black/25">
        ◇
      </div>
    );
  }
  return (
    <div className="relative min-h-36">
      <Image src={src} alt={alt} fill sizes="144px" className="object-cover" />
    </div>
  );
}

function FlagCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: "isActive" | "isFeatured";
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold">
      <input
        className="size-4 accent-black"
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
      />
      {label}
    </label>
  );
}

function AdminField({
  label,
  name,
  placeholder,
  maxLength,
  pattern,
}: {
  label: string;
  name: string;
  placeholder?: string;
  maxLength: number;
  pattern?: string;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input
        className="field"
        name={name}
        placeholder={placeholder}
        maxLength={maxLength}
        pattern={pattern}
        required
      />
    </label>
  );
}

function AdminTextarea({
  label,
  name,
  minLength,
}: {
  label: string;
  name: string;
  minLength: number;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <textarea
        className="field min-h-36"
        name={name}
        minLength={minLength}
        maxLength={3000}
        required
      />
    </label>
  );
}

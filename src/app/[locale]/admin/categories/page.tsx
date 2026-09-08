import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { createCategory, updateCategory } from "../catalog-actions";

export default async function AdminCategoriesPage({
  params,
}: PageProps<"/[locale]/admin/categories">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const categories = await requireDatabase().category.findMany({
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
          <p className="eyebrow text-wine">Product taxonomy</p>
          <h1 className="display mt-4 text-6xl">Categories</h1>
        </div>
        <Link
          href="/admin/products"
          className="border border-black/20 px-4 py-2 text-xs font-bold tracking-wider uppercase"
        >
          Back to products
        </Link>
      </div>

      <div className="bg-porcelain mt-8 overflow-x-auto border border-black/15">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-black/15 text-xs tracking-wider uppercase">
            <tr>
              <th className="p-4">Category</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Products</th>
              <th className="p-4">Visibility</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {categories.map((category) => {
              const english = category.translations.find(
                (translation) => translation.locale === "en",
              );
              const chinese =
                category.translations.find(
                  (translation) => translation.locale === "zh",
                ) ?? english;
              return (
                <tr key={category.id}>
                  <td className="p-4">
                    <strong>{english?.name ?? category.slug}</strong>
                    <span className="mt-1 block text-xs text-black/40">
                      {chinese?.name ?? category.slug}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-black/55">{category.slug}</td>
                  <td className="p-4">{category._count.products}</td>
                  <td className="p-4">
                    <form
                      action={updateCategory}
                      className="flex items-center gap-3"
                    >
                      <input type="hidden" name="locale" value={safeLocale} />
                      <input type="hidden" name="id" value={category.id} />
                      <label className="flex items-center gap-2 text-xs font-bold">
                        <input
                          className="size-4 accent-black"
                          type="checkbox"
                          name="isActive"
                          defaultChecked={category.isActive}
                        />
                        Active
                      </label>
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
                        className="text-wine px-2 py-2 text-xs font-bold"
                      >
                        Deactivate
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!categories.length && (
          <p className="p-6 text-sm text-black/45">No categories yet.</p>
        )}
      </div>

      <section className="bg-porcelain mt-12 border border-black/15 p-6 md:p-8">
        <p className="eyebrow text-wine">New grouping</p>
        <h2 className="display mt-3 text-4xl">Create category</h2>
        <form action={createCategory} className="mt-8 space-y-7">
          <input type="hidden" name="locale" value={safeLocale} />
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField
              label="URL slug"
              name="slug"
              placeholder="press-on-sets"
              maxLength={120}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
            <label className="bg-paper-deep flex min-h-12 items-center gap-3 self-end border border-black/10 px-4 text-sm">
              <input
                className="size-4 accent-black"
                type="checkbox"
                name="isActive"
                defaultChecked
              />
              Active
            </label>
            <AdminField label="English name" name="nameEn" maxLength={160} />
            <AdminField label="中文名称" name="nameZh" maxLength={160} />
            <AdminTextarea label="English description" name="descriptionEn" />
            <AdminTextarea label="中文描述" name="descriptionZh" />
          </div>
          <button className="button-primary">Create category</button>
        </form>
      </section>
    </div>
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

function AdminTextarea({ label, name }: { label: string; name: string }) {
  return (
    <label>
      <span className="field-label">
        {label} <span className="text-black/35 normal-case">(optional)</span>
      </span>
      <textarea className="field min-h-28" name={name} maxLength={2000} />
    </label>
  );
}

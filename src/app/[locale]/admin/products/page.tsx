import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { ImageManager } from "@/components/admin/image-manager";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { createProduct, updateProduct } from "../catalog-actions";

export default async function AdminProductsPage({
  params,
}: PageProps<"/[locale]/admin/products">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const database = requireDatabase();
  const [products, categories, collections] = await Promise.all([
    database.product.findMany({
      include: {
        translations: { where: { locale: "en" }, take: 1 },
        variants: { include: { inventory: true } },
        _count: { select: { categories: true, collections: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    database.category.findMany({
      include: {
        translations: { where: { locale: "en" }, take: 1 },
      },
      orderBy: [{ isActive: "desc" }, { position: "asc" }],
    }),
    database.collection.findMany({
      include: {
        translations: { where: { locale: "en" }, take: 1 },
      },
      orderBy: [{ isActive: "desc" }, { position: "asc" }],
    }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow text-wine">Catalog</p>
          <h1 className="display mt-4 text-6xl">Products</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/categories"
            className="border border-black/20 px-4 py-2 text-xs font-bold tracking-wider uppercase"
          >
            Categories
          </Link>
          <Link
            href="/admin/collections"
            className="border border-black/20 px-4 py-2 text-xs font-bold tracking-wider uppercase"
          >
            Collections
          </Link>
        </div>
      </div>

      <div className="bg-porcelain mt-8 overflow-x-auto border border-black/15">
        <table className="w-full min-w-[54rem] text-left text-sm">
          <thead className="border-b border-black/15 text-xs tracking-wider uppercase">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">Price & status</th>
              <th className="p-4">Catalog links</th>
              <th className="p-4">Variants</th>
              <th className="p-4">Available</th>
              <th className="p-4">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="p-4">
                  <strong>
                    {product.translations[0]?.name ?? product.slug}
                  </strong>
                  <span className="mt-1 block text-xs text-black/40">
                    {product.slug}
                  </span>
                </td>
                <td className="p-4">
                  <form action={updateProduct} className="grid min-w-48 gap-2">
                    <input type="hidden" name="locale" value={safeLocale} />
                    <input type="hidden" name="id" value={product.id} />
                    <input
                      className="field !min-h-9 !py-1"
                      aria-label={`Base price for ${product.slug}`}
                      type="number"
                      min="0.01"
                      max="100000"
                      step="0.01"
                      name="price"
                      defaultValue={Number(product.basePrice)}
                      required
                    />
                    <select
                      className="field !min-h-9 !py-1"
                      aria-label={`Status for ${product.slug}`}
                      name="status"
                      defaultValue={product.status}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        name="intent"
                        value="save"
                        className="border border-black/20 px-3 py-2 text-xs font-bold"
                      >
                        Save
                      </button>
                      <button
                        name="intent"
                        value="archive"
                        className="text-wine px-3 py-2 text-xs font-bold"
                      >
                        Archive
                      </button>
                    </div>
                  </form>
                </td>
                <td className="p-4 text-xs leading-6 text-black/55">
                  <span className="block">
                    {product._count.categories}{" "}
                    {product._count.categories === 1
                      ? "category"
                      : "categories"}
                  </span>
                  <span className="block">
                    {product._count.collections}{" "}
                    {product._count.collections === 1
                      ? "collection"
                      : "collections"}
                  </span>
                </td>
                <td className="p-4">{product.variants.length}</td>
                <td className="p-4">
                  {product.variants.reduce(
                    (sum, variant) =>
                      sum +
                      Math.max(
                        0,
                        (variant.inventory?.quantityOnHand ?? 0) -
                          (variant.inventory?.quantityReserved ?? 0),
                      ),
                    0,
                  )}
                </td>
                <td className="p-4">
                  {product.updatedAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && (
          <p className="p-6 text-sm text-black/45">No products yet.</p>
        )}
      </div>

      <section className="bg-porcelain mt-12 border border-black/15 p-6 md:p-8">
        <p className="eyebrow text-wine">New catalog object</p>
        <h2 className="display mt-3 text-4xl">Create product</h2>
        <form action={createProduct} className="mt-8 space-y-10">
          <input type="hidden" name="locale" value={safeLocale} />

          <fieldset>
            <legend className="eyebrow mb-5 text-black/45">
              Identity & copy
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <AdminField
                label="URL slug"
                name="slug"
                placeholder="moonstone-almond"
                maxLength={160}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              />
              <label>
                <span className="field-label">Type</span>
                <select
                  className="field"
                  name="type"
                  defaultValue="PRESS_ON_SET"
                >
                  <option value="PRESS_ON_SET">Press-on set</option>
                  <option value="SUPPLY">Supply</option>
                  <option value="ACCESSORY">Accessory</option>
                </select>
              </label>
              <AdminField label="English name" name="nameEn" maxLength={160} />
              <AdminField label="中文名称" name="nameZh" maxLength={160} />
              <AdminTextarea
                label="English description"
                name="descriptionEn"
                minLength={10}
              />
              <AdminTextarea
                label="中文描述"
                name="descriptionZh"
                minLength={5}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-5 text-black/45">
              Pricing & first variant
            </legend>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <AdminField
                label="Base price"
                name="price"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
              />
              <AdminField
                label="Compare-at price"
                name="compareAtPrice"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required={false}
              />
              <AdminField
                label="Variant price"
                name="variantPrice"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required={false}
              />
              <AdminField
                label="SKU"
                name="sku"
                placeholder="LUNA-MOON-M"
                maxLength={80}
              />
              <AdminField
                label="Variant name"
                name="variantName"
                defaultValue="Standard"
                maxLength={120}
              />
              <AdminField
                label="Initial stock"
                name="stock"
                type="number"
                min="0"
                max="100000"
                step="1"
              />
              <AdminField
                label="Size"
                name="size"
                placeholder="Medium"
                maxLength={80}
                required={false}
              />
              <AdminField
                label="Shape"
                name="shape"
                placeholder="Almond"
                maxLength={80}
                required={false}
              />
              <AdminField
                label="Finish"
                name="finish"
                placeholder="Gloss"
                maxLength={80}
                required={false}
              />
            </div>
          </fieldset>

          <div className="grid gap-8 lg:grid-cols-2">
            <CatalogAssignments
              legend="Categories"
              name="categoryIds"
              emptyLabel="No categories exist yet."
              records={categories.map((category) => ({
                id: category.id,
                label: category.translations[0]?.name ?? category.slug,
                isActive: category.isActive,
              }))}
            />
            <CatalogAssignments
              legend="Collections"
              name="collectionIds"
              emptyLabel="No collections exist yet."
              records={collections.map((collection) => ({
                id: collection.id,
                label: collection.translations[0]?.name ?? collection.slug,
                isActive: collection.isActive,
              }))}
            />
          </div>

          <div>
            <h3 className="field-label mb-2">Product images</h3>
            <p className="mb-4 text-xs leading-5 text-black/50">
              Upload up to 12 images, add bilingual alternative text, then set
              one primary image.
            </p>
            <ImageManager />
          </div>
          <button className="button-primary">Create product</button>
        </form>
      </section>
    </div>
  );
}

function CatalogAssignments({
  legend,
  name,
  emptyLabel,
  records,
}: {
  legend: string;
  name: "categoryIds" | "collectionIds";
  emptyLabel: string;
  records: Array<{ id: string; label: string; isActive: boolean }>;
}) {
  return (
    <fieldset className="border border-black/15 p-5">
      <legend className="eyebrow px-2 text-black/45">{legend}</legend>
      {records.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {records.map((record) => (
            <label
              key={record.id}
              className="flex items-center gap-3 text-sm leading-5"
            >
              <input
                className="size-4 accent-black"
                type="checkbox"
                name={name}
                value={record.id}
              />
              <span>
                {record.label}
                {!record.isActive && (
                  <span className="ml-1 text-xs text-black/40">(inactive)</span>
                )}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-black/45">{emptyLabel}</p>
      )}
    </fieldset>
  );
}

function AdminField({
  label,
  name,
  type = "text",
  placeholder,
  step,
  min,
  max,
  maxLength,
  pattern,
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  pattern?: string;
  defaultValue?: string | number;
  required?: boolean;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input
        className="field"
        name={name}
        type={type}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        maxLength={maxLength}
        pattern={pattern}
        defaultValue={defaultValue}
        required={required}
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
        maxLength={5000}
        required
      />
    </label>
  );
}

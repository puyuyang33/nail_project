import type { Locale } from "@/i18n/routing";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { ImageManager } from "@/components/admin/image-manager";
import { createProduct, updateProduct } from "../actions";

export default async function AdminProductsPage({
  params,
}: PageProps<"/[locale]/admin/products">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const products = await requireDatabase().product.findMany({
    include: {
      translations: { where: { locale: "en" }, take: 1 },
      variants: { include: { inventory: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <p className="eyebrow text-wine">Catalog</p>
      <h1 className="display mt-4 text-6xl">Products</h1>
      <div className="bg-porcelain mt-8 overflow-x-auto border border-black/15">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="border-b border-black/15 text-xs tracking-wider uppercase">
            <tr>
              <th className="p-4">Product</th>
              <th className="p-4">Price & status</th>
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
                      type="number"
                      step="0.01"
                      name="price"
                      defaultValue={Number(product.basePrice)}
                    />
                    <select
                      className="field !min-h-9 !py-1"
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
                        className="border border-black/20 px-3 py-2 text-xs"
                      >
                        Save
                      </button>
                      <button
                        name="intent"
                        value="archive"
                        className="text-wine px-3 py-2 text-xs"
                      >
                        Archive
                      </button>
                    </div>
                  </form>
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
      </div>

      <section className="bg-porcelain mt-12 border border-black/15 p-6 md:p-8">
        <p className="eyebrow text-wine">New catalog object</p>
        <h2 className="display mt-3 text-4xl">Create product</h2>
        <form action={createProduct} className="mt-8 space-y-8">
          <input type="hidden" name="locale" value={safeLocale} />
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField
              label="URL slug"
              name="slug"
              placeholder="moonstone-almond"
            />
            <AdminField label="SKU" name="sku" placeholder="LUNA-MOON-M" />
            <AdminField label="English name" name="nameEn" />
            <AdminField label="中文名称" name="nameZh" />
            <AdminField label="Price" name="price" type="number" step="0.01" />
            <AdminField
              label="Compare-at price"
              name="compareAtPrice"
              type="number"
              step="0.01"
              required={false}
            />
            <AdminField label="Initial stock" name="stock" type="number" />
            <label>
              <span className="field-label">Type</span>
              <select className="field" name="type" defaultValue="PRESS_ON_SET">
                <option value="PRESS_ON_SET">Press-on set</option>
                <option value="SUPPLY">Supply</option>
                <option value="ACCESSORY">Accessory</option>
              </select>
            </label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <AdminTextarea label="English description" name="descriptionEn" />
            <AdminTextarea label="中文描述" name="descriptionZh" />
          </div>
          <div>
            <h3 className="field-label mb-3">Product images</h3>
            <ImageManager />
          </div>
          <button className="button-primary">Create product</button>
        </form>
      </section>
    </div>
  );
}

function AdminField({
  label,
  name,
  type = "text",
  placeholder,
  step,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  step?: string;
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
        required={required}
      />
    </label>
  );
}

function AdminTextarea({ label, name }: { label: string; name: string }) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <textarea className="field min-h-36" name={name} required />
    </label>
  );
}

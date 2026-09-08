import Image from "next/image";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { ImageManager } from "@/components/admin/image-manager";
import { requireAdmin } from "@/lib/authorization";
import { requireDatabase } from "@/lib/db";
import { createService, updateService } from "../catalog-actions";

export default async function AdminServicesPage({
  params,
}: PageProps<"/[locale]/admin/services">) {
  const { locale } = await params;
  const safeLocale = locale as Locale;
  await requireAdmin(safeLocale);
  const database = requireDatabase();
  const [services, activeStaff] = await Promise.all([
    database.service.findMany({
      include: {
        translations: true,
        staff: { include: { staff: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
    }),
    database.staffMember.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { displayName: "asc" }],
    }),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow text-wine">Studio menu</p>
          <h1 className="display mt-4 text-6xl">Services</h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-black/50">
          Availability depends on active artists. Deactivating a service keeps
          its appointment history intact.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {services.map((service) => {
          const english = service.translations.find(
            (translation) => translation.locale === "en",
          );
          const chinese =
            service.translations.find(
              (translation) => translation.locale === "zh",
            ) ?? english;
          const assignedIds = service.staff.map((relation) => relation.staffId);

          return (
            <article
              key={service.id}
              className="bg-porcelain border border-black/15"
            >
              <div className="grid gap-5 p-5 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
                <ServiceImage
                  src={service.imageUrl}
                  alt={english?.name ?? service.slug}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display text-3xl">
                      {english?.name ?? service.slug}
                    </h2>
                    <StatusPill active={service.isActive}>
                      {service.isActive ? "Active" : "Inactive"}
                    </StatusPill>
                    <StatusPill active={service.isBookable}>
                      {service.isBookable ? "Bookable" : "Not bookable"}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-black/45">{service.slug}</p>
                  <p className="mt-3 text-sm text-black/60">
                    ${Number(service.basePrice).toFixed(2)} ·{" "}
                    {service.durationMinutes} min · {service.staff.length}{" "}
                    {service.staff.length === 1 ? "artist" : "artists"} ·{" "}
                    {service._count.appointments} appointments
                  </p>
                </div>
                <Link
                  href={`/services/${service.slug}`}
                  className="text-xs font-bold tracking-wider uppercase underline underline-offset-4"
                >
                  Public page
                </Link>
              </div>

              <details className="border-t border-black/10">
                <summary className="cursor-pointer px-5 py-4 text-xs font-bold tracking-wider uppercase">
                  Edit service
                </summary>
                <form
                  action={updateService}
                  className="space-y-9 border-t border-black/10 p-5 md:p-7"
                >
                  <input type="hidden" name="locale" value={safeLocale} />
                  <input type="hidden" name="id" value={service.id} />

                  <div className="grid gap-5 sm:grid-cols-2">
                    <AdminField
                      label="URL slug"
                      name="slug"
                      defaultValue={service.slug}
                      maxLength={140}
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FlagCheckbox
                        name="isActive"
                        label="Active"
                        defaultChecked={service.isActive}
                      />
                      <FlagCheckbox
                        name="isBookable"
                        label="Bookable"
                        defaultChecked={service.isBookable}
                      />
                    </div>
                    <AdminField
                      label="English name"
                      name="nameEn"
                      defaultValue={english?.name ?? service.slug}
                      maxLength={160}
                    />
                    <AdminField
                      label="中文名称"
                      name="nameZh"
                      defaultValue={
                        chinese?.name ?? english?.name ?? service.slug
                      }
                      maxLength={160}
                    />
                    <AdminTextarea
                      label="English description"
                      name="descriptionEn"
                      defaultValue={english?.description ?? ""}
                      minLength={10}
                    />
                    <AdminTextarea
                      label="中文描述"
                      name="descriptionZh"
                      defaultValue={
                        chinese?.description ?? english?.description ?? ""
                      }
                      minLength={5}
                    />
                  </div>

                  <ServiceNumbers
                    price={Number(service.basePrice)}
                    durationMinutes={service.durationMinutes}
                    bufferBeforeMinutes={service.bufferBeforeMinutes}
                    bufferAfterMinutes={service.bufferAfterMinutes}
                    depositAmount={
                      service.depositAmount === null
                        ? undefined
                        : Number(service.depositAmount)
                    }
                  />

                  <StaffChoices staff={activeStaff} selectedIds={assignedIds} />

                  <div>
                    <h3 className="field-label mb-2">Replace service image</h3>
                    <p className="mb-4 text-xs leading-5 text-black/50">
                      Leave this empty to keep the current image. If you upload
                      several, the primary image is used.
                    </p>
                    <ImageManager />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      name="intent"
                      value="save"
                      className="button-primary"
                    >
                      Save service
                    </button>
                    <button
                      name="intent"
                      value="deactivate"
                      className="border-wine text-wine inline-flex min-h-11 items-center border px-5 text-xs font-bold tracking-wider uppercase"
                    >
                      Deactivate
                    </button>
                  </div>
                </form>
              </details>
            </article>
          );
        })}
        {!services.length && (
          <div className="bg-porcelain border border-black/15 p-7 text-sm text-black/45">
            No services yet.
          </div>
        )}
      </div>

      <section className="bg-porcelain mt-12 border border-black/15 p-6 md:p-8">
        <p className="eyebrow text-wine">New studio ritual</p>
        <h2 className="display mt-3 text-4xl">Create service</h2>
        <form action={createService} className="mt-8 space-y-10">
          <input type="hidden" name="locale" value={safeLocale} />

          <div className="grid gap-5 sm:grid-cols-2">
            <AdminField
              label="URL slug"
              name="slug"
              placeholder="botanical-gel-manicure"
              maxLength={140}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
            <div className="grid grid-cols-2 gap-4">
              <FlagCheckbox name="isActive" label="Active" defaultChecked />
              <FlagCheckbox
                name="isBookable"
                label="Bookable"
                defaultChecked={activeStaff.length > 0}
              />
            </div>
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

          <ServiceNumbers />
          <StaffChoices staff={activeStaff} selectedIds={[]} />

          <div>
            <h3 className="field-label mb-2">Service image</h3>
            <p className="mb-4 text-xs leading-5 text-black/50">
              Upload an image with bilingual alternative text. The primary
              upload becomes the service cover.
            </p>
            <ImageManager />
          </div>
          <button className="button-primary">Create service</button>
        </form>
      </section>
    </div>
  );
}

function ServiceImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="bg-paper-deep grid aspect-square place-items-center text-2xl text-black/25">
        ✦
      </div>
    );
  }
  return (
    <div className="relative aspect-square overflow-hidden">
      <Image src={src} alt={alt} fill sizes="96px" className="object-cover" />
    </div>
  );
}

function StatusPill({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`px-2 py-1 text-[0.62rem] font-bold tracking-wider uppercase ${
        active ? "bg-acid text-ink" : "bg-paper-deep text-black/45"
      }`}
    >
      {children}
    </span>
  );
}

function ServiceNumbers({
  price,
  durationMinutes,
  bufferBeforeMinutes,
  bufferAfterMinutes,
  depositAmount,
}: {
  price?: number;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  depositAmount?: number;
}) {
  return (
    <fieldset>
      <legend className="eyebrow mb-5 text-black/45">Timing & payment</legend>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <AdminField
          label="Price"
          name="price"
          type="number"
          min="0.01"
          max="100000"
          step="0.01"
          defaultValue={price}
        />
        <AdminField
          label="Duration (min)"
          name="durationMinutes"
          type="number"
          min="5"
          max="720"
          step="1"
          defaultValue={durationMinutes ?? 60}
        />
        <AdminField
          label="Buffer before"
          name="bufferBeforeMinutes"
          type="number"
          min="0"
          max="240"
          step="1"
          defaultValue={bufferBeforeMinutes ?? 0}
        />
        <AdminField
          label="Buffer after"
          name="bufferAfterMinutes"
          type="number"
          min="0"
          max="240"
          step="1"
          defaultValue={bufferAfterMinutes ?? 0}
        />
        <AdminField
          label="Deposit"
          name="depositAmount"
          type="number"
          min="0.01"
          max="100000"
          step="0.01"
          defaultValue={depositAmount}
          required={false}
        />
      </div>
    </fieldset>
  );
}

function StaffChoices({
  staff,
  selectedIds,
}: {
  staff: Array<{ id: string; displayName: string; email: string | null }>;
  selectedIds: readonly string[];
}) {
  return (
    <fieldset className="border border-black/15 p-5">
      <legend className="eyebrow px-2 text-black/45">Assigned artists</legend>
      {staff.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <label key={member.id} className="flex items-start gap-3 text-sm">
              <input
                className="mt-0.5 size-4 accent-black"
                type="checkbox"
                name="staffIds"
                value={member.id}
                defaultChecked={selectedIds.includes(member.id)}
              />
              <span>
                <strong className="block">{member.displayName}</strong>
                {member.email && (
                  <span className="mt-0.5 block text-xs text-black/40">
                    {member.email}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-black/50">
          No active staff members are available.{" "}
          <Link href="/admin/staff" className="underline underline-offset-4">
            Manage staff
          </Link>
          .
        </p>
      )}
    </fieldset>
  );
}

function FlagCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: "isActive" | "isBookable";
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="bg-paper-deep flex min-h-12 items-center gap-3 border border-black/10 px-4 text-sm">
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
  type = "text",
  placeholder,
  min,
  max,
  step,
  maxLength,
  pattern,
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
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
        min={min}
        max={max}
        step={step}
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
  defaultValue,
}: {
  label: string;
  name: string;
  minLength: number;
  defaultValue?: string;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <textarea
        className="field min-h-36"
        name={name}
        minLength={minLength}
        maxLength={5000}
        defaultValue={defaultValue}
        required
      />
    </label>
  );
}

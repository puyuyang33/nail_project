import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { ContentDocumentEditor } from "@/components/admin/content-document-editor";
import { getEditableContentPage } from "@/data/content-repository";
import { requireAdmin } from "@/lib/authorization";
import { isDocumentStoreConfigured } from "@/lib/document-store";

export default async function AdminContentDocumentPage({
  params,
}: PageProps<"/[locale]/admin/content/[...key]">) {
  const { locale, key: segments } = await params;
  await requireAdmin(locale as Locale);
  const key = segments.join("/");
  const content = await getEditableContentPage(key);
  if (!content) notFound();

  return (
    <div>
      <p className="eyebrow text-wine">MongoDB content document</p>
      <h1 className="display mt-4 text-6xl">{key}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-6 text-black/55">
        Public pages read a published MongoDB document when available and
        otherwise use the version-controlled static content.
      </p>
      <div className="mt-9">
        <ContentDocumentEditor
          contentKey={key}
          initialPage={content.page}
          initialVersion={content.version}
          initialPublished={content.published}
          source={content.source}
          configured={isDocumentStoreConfigured()}
        />
      </div>
    </div>
  );
}

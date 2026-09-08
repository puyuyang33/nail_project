import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  getEditableContentPage,
  saveContentPage,
} from "@/data/content-repository";
import {
  contentKeySchema,
  contentPageSchema,
} from "@/features/content/document-schema";
import { isAdminRole } from "@/lib/authorization";
import {
  DocumentVersionConflictError,
  isDocumentStoreConfigured,
} from "@/lib/document-store";
import { rejectUntrustedOrigin } from "@/lib/request-security";
import { routing } from "@/i18n/routing";

const writeSchema = z.object({
  expectedVersion: z.number().int().min(0),
  published: z.boolean(),
  page: contentPageSchema,
});

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/content/[...key]">,
) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }
  const key = (await context.params).key.join("/");
  if (!contentKeySchema.safeParse(key).success) {
    return Response.json({ error: "Invalid content key." }, { status: 400 });
  }
  const content = await getEditableContentPage(key);
  if (!content) {
    return Response.json(
      { error: "Content document not found." },
      { status: 404 },
    );
  }
  return Response.json({
    ...content,
    documentStoreConfigured: isDocumentStoreConfigured(),
  });
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/content/[...key]">,
) {
  const originError = rejectUntrustedOrigin(request);
  if (originError) return originError;
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return Response.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }
  if (!isDocumentStoreConfigured()) {
    return Response.json(
      {
        error:
          "MongoDB content storage is disabled. Configure NOSQL_PROVIDER and MONGODB_URI.",
      },
      { status: 503 },
    );
  }
  const key = (await context.params).key.join("/");
  if (!contentKeySchema.safeParse(key).success) {
    return Response.json({ error: "Invalid content key." }, { status: 400 });
  }
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Content document is invalid.", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await saveContentPage({
      key,
      page: parsed.data.page,
      expectedVersion: parsed.data.expectedVersion,
      published: parsed.data.published,
      actorId: session.user.id,
    });
    for (const locale of routing.locales) {
      revalidatePath(`/${locale}/${key}`);
    }
    return Response.json({
      version: result.document.version,
      updatedAt: result.document.updatedAt,
      published: result.document.published,
      eventLogged: result.eventLogged,
      ...("warning" in result ? { warning: result.warning } : {}),
    });
  } catch (error) {
    if (error instanceof DocumentVersionConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json(
      { error: "MongoDB content storage is temporarily unavailable." },
      { status: 503 },
    );
  }
}

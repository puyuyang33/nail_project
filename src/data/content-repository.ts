import "server-only";
import { cache } from "react";
import {
  contentKeySchema,
  contentPageSchema,
} from "@/features/content/document-schema";
import {
  getDocumentStore,
  isDocumentStoreConfigured,
  type ContentDocument,
} from "@/lib/document-store";
import { contentPages, type ContentPage } from "./content";

export type ResolvedContent = {
  page: ContentPage;
  source: "static" | "mongodb";
  version: number;
  published: boolean;
  updatedAt: Date | null;
};

async function resolvePublishedContentPage(
  key: string,
): Promise<ResolvedContent | null> {
  const validKey = contentKeySchema.safeParse(key);
  if (!validKey.success) return null;
  const fallback = contentPages[key];
  if (!isDocumentStoreConfigured()) {
    return fallback ? staticContent(fallback) : null;
  }
  const document = await getDocumentStore().getContent(key);
  if (!document?.published) return fallback ? staticContent(fallback) : null;
  return resolveDocument(document);
}

export const getPublishedContentPage = cache(resolvePublishedContentPage);

export async function getEditableContentPage(
  key: string,
): Promise<ResolvedContent | null> {
  const validKey = contentKeySchema.safeParse(key);
  if (!validKey.success) return null;
  if (isDocumentStoreConfigured()) {
    const document = await getDocumentStore().getContent(key);
    if (document) return resolveDocument(document);
  }
  const fallback = contentPages[key];
  return fallback ? staticContent(fallback) : null;
}

export async function saveContentPage({
  key,
  page,
  expectedVersion,
  published,
  actorId,
}: {
  key: string;
  page: ContentPage;
  expectedVersion: number;
  published: boolean;
  actorId: string;
}) {
  const validKey = contentKeySchema.parse(key);
  const validPage = contentPageSchema.parse(page) as ContentPage;
  const store = getDocumentStore();
  const document = await store.saveContent({
    key: validKey,
    payload: validPage,
    expectedVersion,
    published,
    updatedBy: actorId,
  });
  try {
    await store.appendOperationalEvent({
      kind: "content.updated",
      entityType: "ContentDocument",
      entityId: validKey,
      actorId,
      payload: {
        version: document.version,
        published: document.published,
      },
    });
    return { document, eventLogged: true as const };
  } catch (error) {
    return {
      document,
      eventLogged: false as const,
      warning:
        error instanceof Error
          ? `Content saved, but the operational event failed: ${error.message}`
          : "Content saved, but the operational event failed.",
    };
  }
}

function resolveDocument(document: ContentDocument): ResolvedContent {
  const parsed = contentPageSchema.safeParse(document.payload);
  if (!parsed.success) {
    throw new Error(
      `Content document "${document.key}" does not match schema version ${document.schemaVersion}.`,
    );
  }
  return {
    page: parsed.data as ContentPage,
    source: "mongodb",
    version: document.version,
    published: document.published,
    updatedAt: document.updatedAt,
  };
}

function staticContent(page: ContentPage): ResolvedContent {
  return {
    page,
    source: "static",
    version: 0,
    published: true,
    updatedAt: null,
  };
}

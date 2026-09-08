import "server-only";
import { env } from "@/lib/env";
import { MongoDocumentStore, closeMongoDocumentStore } from "./mongodb";
import type { DocumentStore } from "./types";

let documentStore: DocumentStore | null = null;

export function isDocumentStoreConfigured() {
  return env.NOSQL_PROVIDER === "mongodb" && Boolean(env.MONGODB_URI);
}

export function getDocumentStore(): DocumentStore {
  if (!isDocumentStoreConfigured()) {
    throw new Error(
      "The document store is disabled. Set NOSQL_PROVIDER=mongodb and MONGODB_URI.",
    );
  }
  documentStore ??= new MongoDocumentStore();
  return documentStore;
}

export async function initializeDocumentStore() {
  return getDocumentStore().ping();
}

export async function closeDocumentStore() {
  documentStore = null;
  await closeMongoDocumentStore();
}

export type {
  ContentDocument,
  ContentWrite,
  DocumentStore,
  OperationalEvent,
} from "./types";
export { DocumentVersionConflictError } from "./types";

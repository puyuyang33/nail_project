import type { ContentPage } from "@/data/content";

export type ContentDocument = {
  key: string;
  schemaVersion: 1;
  version: number;
  published: boolean;
  payload: ContentPage;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
};

export type ContentWrite = {
  key: string;
  payload: ContentPage;
  published: boolean;
  updatedBy: string;
  expectedVersion?: number;
};

export type OperationalEvent = {
  kind: string;
  entityType: string;
  entityId?: string;
  actorId?: string;
  severity?: "info" | "warning" | "error";
  payload?: Record<string, unknown>;
};

export interface DocumentStore {
  getContent(key: string): Promise<ContentDocument | null>;
  saveContent(input: ContentWrite): Promise<ContentDocument>;
  appendOperationalEvent(event: OperationalEvent): Promise<void>;
  ping(): Promise<boolean>;
}

export class DocumentVersionConflictError extends Error {
  constructor(key: string) {
    super(`Content document "${key}" was changed by another editor.`);
    this.name = "DocumentVersionConflictError";
  }
}

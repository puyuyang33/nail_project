import "server-only";
import {
  MongoClient,
  MongoServerError,
  ServerApiVersion,
  type Collection,
  type Db,
  type Document,
} from "mongodb";
import { env } from "@/lib/env";
import {
  DocumentVersionConflictError,
  type ContentDocument,
  type ContentWrite,
  type DocumentStore,
  type OperationalEvent,
} from "./types";

type ContentRecord = ContentDocument & Document;
type OperationalEventRecord = OperationalEvent &
  Document & {
    createdAt: Date;
  };

const globalMongo = globalThis as unknown as {
  lunariaMongoClient?: MongoClient;
  lunariaMongoIndexes?: Promise<void>;
};

function createClient() {
  if (!env.MONGODB_URI) {
    throw new Error(
      "MongoDB is not configured. Set MONGODB_URI or disable NOSQL_PROVIDER.",
    );
  }
  return new MongoClient(env.MONGODB_URI, {
    appName: "lunaria-nail-atelier",
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
}

function getClient() {
  globalMongo.lunariaMongoClient ??= createClient();
  return globalMongo.lunariaMongoClient;
}

async function getDatabase() {
  const database = getClient().db(env.MONGODB_DATABASE);
  await ensureIndexes(database);
  return database;
}

async function ensureIndexes(database: Db) {
  if (!globalMongo.lunariaMongoIndexes) {
    globalMongo.lunariaMongoIndexes = Promise.all([
      contentCollection(database).createIndex(
        { key: 1 },
        { unique: true, name: "content_key_unique" },
      ),
      contentCollection(database).createIndex(
        { published: 1, updatedAt: -1 },
        { name: "content_publication" },
      ),
      ensureOperationalEventTtl(database),
      eventCollection(database).createIndex(
        { entityType: 1, entityId: 1, createdAt: -1 },
        { name: "operational_event_entity" },
      ),
      eventCollection(database).createIndex(
        { kind: 1, createdAt: -1 },
        { name: "operational_event_kind" },
      ),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        globalMongo.lunariaMongoIndexes = undefined;
        throw error;
      });
  }
  return globalMongo.lunariaMongoIndexes;
}

async function ensureOperationalEventTtl(database: Db) {
  const collection = eventCollection(database);
  const name = "operational_event_retention";
  const expireAfterSeconds = env.NOSQL_EVENT_RETENTION_DAYS * 24 * 60 * 60;
  try {
    await collection.createIndex(
      { createdAt: 1 },
      { name, expireAfterSeconds },
    );
    return;
  } catch (error) {
    if (
      !(error instanceof MongoServerError) ||
      (error.code !== 85 && error.code !== 86)
    ) {
      throw error;
    }
  }

  try {
    await collection.dropIndex(name);
  } catch (error) {
    if (
      !(error instanceof MongoServerError) ||
      (error.code !== 26 && error.code !== 27)
    ) {
      throw error;
    }
  }
  await collection.createIndex({ createdAt: 1 }, { name, expireAfterSeconds });
}

function contentCollection(database: Db): Collection<ContentRecord> {
  return database.collection<ContentRecord>("content_documents");
}

function eventCollection(database: Db): Collection<OperationalEventRecord> {
  return database.collection<OperationalEventRecord>("operational_events");
}

export class MongoDocumentStore implements DocumentStore {
  async getContent(key: string) {
    const database = await getDatabase();
    return contentCollection(database).findOne(
      { key },
      { projection: { _id: 0 } },
    );
  }

  async saveContent(input: ContentWrite) {
    const database = await getDatabase();
    const now = new Date();
    const filter =
      input.expectedVersion === undefined
        ? { key: input.key }
        : { key: input.key, version: input.expectedVersion };
    let result: ContentRecord | null;
    try {
      result = await contentCollection(database).findOneAndUpdate(
        filter,
        {
          $set: {
            schemaVersion: 1,
            payload: input.payload,
            published: input.published,
            updatedAt: now,
            updatedBy: input.updatedBy,
          },
          $setOnInsert: {
            key: input.key,
            createdAt: now,
          },
          $inc: { version: 1 },
        },
        {
          upsert:
            input.expectedVersion === undefined || input.expectedVersion === 0,
          returnDocument: "after",
          projection: { _id: 0 },
        },
      );
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DocumentVersionConflictError(input.key);
      }
      throw error;
    }
    if (!result) throw new DocumentVersionConflictError(input.key);
    return result;
  }

  async appendOperationalEvent(event: OperationalEvent) {
    const database = await getDatabase();
    await eventCollection(database).insertOne({
      ...event,
      severity: event.severity ?? "info",
      createdAt: new Date(),
    });
  }

  async ping() {
    const database = await getDatabase();
    const response = await database.command({ ping: 1 });
    return response.ok === 1;
  }
}

export async function closeMongoDocumentStore() {
  if (!globalMongo.lunariaMongoClient) return;
  await globalMongo.lunariaMongoClient.close();
  globalMongo.lunariaMongoClient = undefined;
  globalMongo.lunariaMongoIndexes = undefined;
}

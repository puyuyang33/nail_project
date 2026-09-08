import "dotenv/config";
import {
  closeDocumentStore,
  initializeDocumentStore,
  isDocumentStoreConfigured,
} from "../src/lib/document-store/index";

async function main() {
  if (!isDocumentStoreConfigured()) {
    throw new Error(
      "MongoDB is disabled. Set NOSQL_PROVIDER=mongodb and MONGODB_URI before running this command.",
    );
  }
  const ready = await initializeDocumentStore();
  if (!ready) throw new Error("MongoDB did not acknowledge the ping command.");
  console.log(
    "MongoDB document store is reachable and required indexes are ready.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "MongoDB setup failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDocumentStore();
  });

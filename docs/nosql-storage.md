# Optional MongoDB document storage

Lunaria uses a deliberately hybrid persistence model. PostgreSQL remains the source
of truth for data that needs foreign keys, uniqueness, money-safe transactions, or
concurrency guarantees. MongoDB is optional and stores documents whose shape changes
more often than their relationships.

The application runs normally with `NOSQL_PROVIDER=disabled`. Public information
pages then use the version-controlled documents in `src/data/content.ts`. This makes
it safe to add MongoDB later without blocking local development or deployment.

For a free local instance, Docker Compose includes MongoDB Community behind the
optional `nosql` profile:

```bash
docker compose --profile nosql up -d mongodb
```

Then use
`MONGODB_URI=mongodb://lunaria:local_development_only@localhost:27017/?authSource=admin`.
These defaults are for local development only.

## What belongs where

| Data                                                   | Store      | Reason                                           |
| ------------------------------------------------------ | ---------- | ------------------------------------------------ |
| Users, roles, sessions, addresses                      | PostgreSQL | Identity constraints and account relations       |
| Products, variants, inventory, carts, orders, payments | PostgreSQL | Transactional stock and money invariants         |
| Services, staff schedules, blocked time, appointments  | PostgreSQL | Conflict-safe relational scheduling              |
| Discount redemption and Stripe event receipts          | PostgreSQL | Atomic limits and payment idempotency            |
| Editable editorial pages and policy documents          | MongoDB    | Nested bilingual sections evolve as one document |
| Content drafts and future page-builder blocks          | MongoDB    | Flexible schemas and document-level versioning   |
| Short-lived operational/event documents                | MongoDB    | Append-oriented records with TTL retention       |

Do not move inventory, payments, orders, or appointment reservations into MongoDB.
Their PostgreSQL transactions and constraints are intentional.

## Free service option

[MongoDB Atlas](https://www.mongodb.com/atlas/database) offers an M0 shared cluster
intended for learning, prototypes, and very small workloads. At the time this
template was prepared, M0 included 512 MB of storage with shared performance and no
managed backup. Atlas can change plan limits, so verify the current
[Atlas free-cluster documentation](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
before launch.

M0 is appropriate for developing this content layer and for a low-traffic demo. It
is not a substitute for backups, capacity planning, an SLA, or production monitoring.
The checked-in static content remains a useful recovery baseline, but export MongoDB
documents before relying on them as business records.

## Create the database later

1. Create an Atlas project and an M0 cluster in a region near the Vercel deployment.
2. Create a dedicated database user with a random password and `readWrite` access
   only to the selected database.
3. Configure Atlas Network Access. A broad IP rule is convenient for serverless
   previews but increases exposure; use the narrowest option available and rely on
   TLS, strong credentials, and secret rotation.
4. Copy the `mongodb+srv://` driver URI. URL-encode special characters in the
   username or password.
5. Set the variables below locally and in the correct Vercel Preview/Production
   scopes.
6. Run `npm run nosql:setup`. It verifies connectivity and creates the indexes.
7. Open `/en/admin/content/about`, save the static document as version 1, and verify
   `/en/about` reads it.

```dotenv
NOSQL_PROVIDER=mongodb
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=lunaria
NOSQL_EVENT_RETENTION_DAYS=90
```

Keep `MONGODB_URI` server-only. Never prefix it with `NEXT_PUBLIC_`, paste it into an
issue, or commit it.

## Collections and indexes

The driver initializes collections lazily on the first document-store request:

### `content_documents`

Each record owns one page-sized document:

- `key`: stable route/content identifier, unique
- `schemaVersion`: currently `1`
- `version`: optimistic concurrency counter
- `published`: whether the public site may use the override
- `payload`: bilingual nested `ContentPage`
- `createdAt`, `updatedAt`, `updatedBy`

Indexes:

- unique `key`
- `published, updatedAt` for administrative listing/publication workflows

An administrator must submit the version they read. A stale edit returns HTTP 409
instead of overwriting a newer document.

### `operational_events`

Append-only documents record flexible operational facts such as a content update.
They contain a kind, entity reference, optional actor, severity, sanitized payload,
and creation time.

Indexes:

- TTL on `createdAt`, controlled by `NOSQL_EVENT_RETENTION_DAYS`
- `entityType, entityId, createdAt`
- `kind, createdAt`

Do not put passwords, bearer tokens, full webhook payloads, card data, or unnecessary
customer contact information into event payloads.

## Application behavior

`src/data/content-repository.ts` resolves public content as follows:

1. With MongoDB disabled, return `src/data/content.ts`.
2. With MongoDB enabled and a published valid document present, return MongoDB.
3. With MongoDB enabled but no published override, return the static document.
4. With MongoDB enabled but unreachable or containing an invalid schema, surface an
   error rather than silently serving stale data.

The protected API at `/api/admin/content/[...key]` reads and writes versioned
documents. The admin editor at `/{locale}/admin/content/[...key]` exposes the JSON
document directly so the storage layer can be established before building a visual
page editor.

## Vercel and connection management

The MongoDB client is cached on `globalThis` and uses a pool capped at five
connections. This reduces connection churn during local hot reloads and within a
warm serverless instance. It does not turn serverless instances into a shared
process; Atlas must still be sized for aggregate concurrent connections.

Use the `mongodb+srv` URI, keep the cluster in a nearby region, and monitor Atlas
connection and operation metrics. Do not call `closeDocumentStore()` in request
handlers; it exists for scripts and tests.

## Changing retention

The operational-event TTL index uses the configured retention. When the value
changes, initialization replaces the conflicting TTL index with the new duration.
Run `npm run nosql:setup` during the release and verify the live index in Atlas.

## Disable or roll back

Set `NOSQL_PROVIDER=disabled` and redeploy. Public content immediately returns to the
checked-in static documents. PostgreSQL commerce and scheduling are unaffected.
Export any MongoDB-only edits before disabling the provider.

For a content rollback while MongoDB stays enabled, save a known-good payload with
the current version or mark the override unpublished to return that route to its
static fallback.

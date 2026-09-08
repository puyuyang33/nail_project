# Lunaria Nail Atelier

A production-oriented, bilingual storefront and appointment-booking template for a
press-on nail studio. It uses Next.js App Router, TypeScript, PostgreSQL, Prisma 7,
Auth.js, Stripe Checkout, Cloudinary, Resend, Upstash, next-intl, Vitest, and
Playwright.

English is served at `/en` and Simplified Chinese at `/zh`. Shopping, checkout,
order tracking, and appointment booking support guests; accounts are optional.

## What is included

- Localized catalog, collections, search, guides, policies, and SEO metadata
- Product variants, inventory reservations, persistent carts, wishlists, and guest checkout
- Stripe-signed, idempotent order and appointment payment webhooks
- Timezone-aware scheduling, staff availability, blocked time, service buffers, and
  a PostgreSQL exclusion constraint preventing overlapping active appointments
- Owner-approved appointment requests, worker/day calendar, staff lifecycle, and
  privacy-safe public availability
- Secure guest appointment-management links and reminder infrastructure
- Google-based Auth.js accounts, role-gated administration, and audit records
- Signed Cloudinary uploads with localized alternative text
- Resend transactional email and Upstash-backed rate limiting
- Responsive, accessible storefront with database-free demo catalog fallbacks

## Architecture

```text
Browser
  ├─ localized App Router pages and React components
  └─ route handlers / server actions (Zod validation + authorization)
       ├─ Prisma 7 + @prisma/adapter-pg ── PostgreSQL
       ├─ MongoDB Atlas (optional) ── flexible content documents
       ├─ Auth.js + Google OAuth ── verified accounts/JWT sessions
       ├─ Stripe ── hosted checkout + signed webhooks
       ├─ Cloudinary ── signed direct image uploads
       ├─ Resend ── transactional email
       └─ Upstash Redis ── distributed public-endpoint rate limits
```

`src/config/store.ts` contains runtime storefront defaults. PostgreSQL stores the
catalog, operational records, translations, and seeded `StoreSetting` values. When
`DATABASE_URL` is absent, read-only catalog and availability screens use
`src/data/demo.ts`; checkout, accounts, persistence, and booking still require a
database.

MongoDB is optional and disabled by default. When enabled, published page documents
override the checked-in editorial content without moving transactional records out
of PostgreSQL. See [Optional MongoDB document storage](docs/nosql-storage.md).

See [Architecture and security](docs/architecture-security.md) for trust boundaries,
data flows, and database details.

## Prerequisites

- Node.js 22.12+ LTS and npm (Prisma also supports Node.js 20.19+ or 24+)
- Docker Desktop with Compose, or PostgreSQL 17+
- Accounts for Stripe, Cloudinary, Resend, Upstash, and Vercel before production
- A Google Cloud OAuth client for account and administrator sign-in

## Local setup

### Setup helper

The helpers create a gitignored `.env` with random local secrets, install exact
dependencies, start PostgreSQL, generate Prisma Client, and deploy migrations.
They seed only when admin credentials are explicitly supplied.

**macOS/Linux**

```bash
export SEED_ADMIN_EMAIL="owner@example.com"
export SEED_ADMIN_PASSWORD="replace-with-a-unique-password"
RUN_SEED=1 sh ./scripts/setup.sh
```

**Windows PowerShell**

```powershell
$env:SEED_ADMIN_EMAIL = "owner@example.com"
$env:SEED_ADMIN_PASSWORD = "replace-with-a-unique-password"
.\scripts\setup.ps1 -Seed
```

Use a unique password between 12 and 72 UTF-8 bytes. Clear it from shell history
and the environment afterward.

### Manual setup

```bash
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:migrate:deploy
```

`npm ci` runs the `postinstall` hook and generates Prisma Client automatically.
Generation uses a local-only fallback URL and does not require PostgreSQL to be
running; database commands still use `DATABASE_URL` when provided.

Create a gitignored `.env`:

```dotenv
DATABASE_URL=postgresql://nail_store:local_development_only@localhost:5432/nail_store?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_SECRET=replace-with-at-least-32-random-characters
CRON_SECRET=replace-with-another-32-character-random-value
BUSINESS_TIMEZONE=America/Chicago
STORE_CURRENCY=USD
APPOINTMENT_DEPOSITS_ENABLED=false
```

Generate a secret without sending it to a third party:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Create the initial administrator and seed the bilingual catalog:

```bash
SEED_ADMIN_EMAIL="owner@example.com" \
SEED_ADMIN_PASSWORD="replace-with-a-unique-password" \
npm run db:seed
```

In PowerShell, set the two values with `$env:...` before `npm run db:seed`.
Then run `npm run dev` and open <http://localhost:3000/en>.

## Environment variables

Never commit `.env` files. Use separate credentials and databases for local,
preview, and production environments.

| Variable                                                             | Required                         | Purpose                                                                               |
| -------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                       | Database features and production | PostgreSQL connection used by Prisma runtime and migrations                           |
| `DIRECT_URL`                                                         | No                               | Reserved for a future pooled/direct split; current Prisma config reads `DATABASE_URL` |
| `NEXT_PUBLIC_APP_URL`                                                | Production                       | Canonical origin used in metadata, redirects, and email links                         |
| `AUTH_SECRET`                                                        | Auth/production                  | At least 32 random characters for Auth.js token signing                               |
| `AUTH_GOOGLE_ID`                                                     | Google sign-in                   | Google OAuth web client ID                                                            |
| `AUTH_GOOGLE_SECRET`                                                 | Google sign-in                   | Google OAuth client secret; server-only                                               |
| `AUTH_GOOGLE_ADMIN_EMAILS`                                           | No                               | Comma-separated verified Google emails promoted to administrator                      |
| `AUTH_CREDENTIALS_ENABLED`                                           | No                               | Enables the optional password fallback; defaults to `false`                           |
| `AUTH_PASSWORD_REGISTRATION_ENABLED`                                 | No                               | Enables public password registration only when credentials are enabled                |
| `STRIPE_SECRET_KEY`                                                  | Checkout                         | Stripe secret key (`sk_test_...` locally)                                             |
| `STRIPE_WEBHOOK_SECRET`                                              | Checkout                         | Signing secret for `/api/stripe/webhook`                                              |
| `CLOUDINARY_CLOUD_NAME`                                              | Image uploads                    | Cloudinary account cloud name                                                         |
| `CLOUDINARY_API_KEY`                                                 | Image uploads                    | Cloudinary API key                                                                    |
| `CLOUDINARY_API_SECRET`                                              | Image uploads                    | Cloudinary API secret; server-only                                                    |
| `RESEND_API_KEY`                                                     | Email                            | Resend key (`re_...`)                                                                 |
| `EMAIL_FROM`                                                         | Email                            | Verified sender, for example `Lunaria <orders@example.com>`                           |
| `UPSTASH_REDIS_REST_URL`                                             | Production rate limits           | Upstash Redis REST URL                                                                |
| `UPSTASH_REDIS_REST_TOKEN`                                           | Production rate limits           | Upstash Redis REST token                                                              |
| `CRON_SECRET`                                                        | Reminders/production             | At least 32 random characters; authenticates the cron route                           |
| `BUSINESS_TIMEZONE`                                                  | No                               | IANA timezone; defaults to `America/Chicago`                                          |
| `STORE_CURRENCY`                                                     | No                               | Validated currency value; keep aligned with `storeConfig.currency`                    |
| `APPOINTMENT_DEPOSITS_ENABLED`                                       | No                               | Enables Stripe-backed appointment deposits; defaults to `false`                       |
| `APPOINTMENT_NOTIFICATION_EMAILS`                                    | No                               | Comma-separated owner/front-desk notification recipients                              |
| `NOSQL_PROVIDER`                                                     | No                               | `disabled` (default) or `mongodb`                                                     |
| `MONGODB_URI`                                                        | MongoDB mode                     | Server-only Atlas/compatible driver URI                                               |
| `MONGODB_DATABASE`                                                   | No                               | Document database name; defaults to `lunaria`                                         |
| `NOSQL_EVENT_RETENTION_DAYS`                                         | No                               | TTL for operational documents; defaults to 90 days                                    |
| `SEED_ADMIN_EMAIL` / `ADMIN_EMAIL`                                   | Seed                             | Initial administrator email                                                           |
| `SEED_ADMIN_PASSWORD` / `ADMIN_PASSWORD`                             | Seed                             | Initial administrator password; never logged or committed                             |
| `SEED_ADMIN_NAME` / `ADMIN_NAME`                                     | No                               | Initial administrator display name                                                    |
| `SEED_ADMIN_ROTATE_PASSWORD`                                         | No                               | Set to `true` only for an intentional seeded-admin password rotation                  |
| `SEED_DEMO_DATA`                                                     | No                               | Set to `true` to add `.test` customer/order/appointment samples                       |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Docker only                      | Override local Compose defaults                                                       |
| `SKIP_ENV_VALIDATION`                                                | Emergency only                   | Bypasses Vercel production checks; do not set in production                           |

The production build rejects missing database, auth, Stripe, Cloudinary, Resend,
Upstash, and cron credentials when `VERCEL_ENV=production`. Operational details are
in [Deployment and operations](docs/deployment-operations.md).

## Authentication and initial administrator

Auth.js uses Google OAuth, the Prisma adapter, and signed JWT sessions. A verified
Google account creates its customer record automatically, so customers do not manage
another password. Only `ADMIN` and `SUPER_ADMIN` roles can enter the protected admin
console; trusted addresses in `AUTH_GOOGLE_ADMIN_EMAILS` are promoted to `ADMIN`.

Password authentication is disabled by default and remains available only behind
explicit fallback flags. See
[Google authentication](docs/google-authentication.md) for Cloud Console origins,
callback URLs, consent-screen setup, and administrator access.

The seed requires administrator credentials from the environment. On repeat runs it
does not change an existing password unless `SEED_ADMIN_ROTATE_PASSWORD=true`.
Never provide seed credentials as command-line arguments, commit them, or place them
in a public CI log.

## Database and seed commands

| Command                               | Use                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run db:generate`                 | Generate Prisma Client after schema changes                                     |
| `npm run db:migrate -- --name <name>` | Create/apply a development migration                                            |
| `npm run db:migrate:deploy`           | Apply committed migrations in CI/production                                     |
| `npm run db:seed`                     | Idempotently upsert admin, bilingual catalog, services, schedules, and settings |
| `npm run db:studio`                   | Inspect a trusted local database                                                |
| `npm run db:push`                     | Prototype only; never replace production migrations                             |

The default seed includes original EN/ZH products, reusable Unsplash imagery,
variants, inventory, categories, collections, services, staff schedules, an inactive
example discount, and settings. Transactional demo data is opt-in with
`SEED_DEMO_DATA=true`. The raw integrity migration under `prisma/migrations` enables
`btree_gist` and rejects overlapping active staff bookings using buffered reservation
ranges.

## Route map

Every page below is prefixed with `/{locale}`, where `locale` is `en` or `zh`.
`/` redirects to `/en`.

### Storefront and content

| Route                                                                             | Purpose                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/`                                                                               | Localized home                                     |
| `/shop`                                                                           | Catalog with filters and sorting                   |
| `/search`                                                                         | Product search                                     |
| `/supplies`                                                                       | Redirect to the supplies catalog filter            |
| `/products/[slug]`                                                                | Product detail, gallery, options, and cart action  |
| `/collections`                                                                    | Collection index                                   |
| `/collections/[slug]`                                                             | Collection detail                                  |
| `/cart`                                                                           | Persistent browser cart                            |
| `/checkout`                                                                       | Guest Stripe checkout                              |
| `/orders/confirmation`                                                            | Checkout return screen                             |
| `/orders/track`                                                                   | Private lookup by order number plus email or phone |
| `/services`                                                                       | Service catalog                                    |
| `/services/[slug]`                                                                | Service detail                                     |
| `/book`                                                                           | Guest booking flow                                 |
| `/book/confirmation`                                                              | Appointment result screen                          |
| `/appointments/manage/[token]`                                                    | Secure guest appointment view/cancellation         |
| `/about`, `/contact`, `/faq`, `/wholesale`                                        | Editorial and inquiry pages                        |
| `/guides/sizing`, `/guides/application-removal`                                   | Customer guides                                    |
| `/policies/shipping`, `/policies/returns`, `/policies/privacy`, `/policies/terms` | Store policies                                     |

### Identity, account, and administration

| Route                                                        | Purpose                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `/login`                                                     | Google OAuth login with optional administrator password fallback                                                          |
| `/register`                                                  | Redirects to Google login unless password registration is explicitly enabled                                              |
| `/forgot-password`, `/reset-password`                        | Available only when password authentication is explicitly enabled                                                         |
| `/account`                                                   | Authenticated account overview                                                                                            |
| `/account/profile`                                           | Contact profile                                                                                                           |
| `/account/orders`                                            | Linked order history                                                                                                      |
| `/account/appointments`                                      | Linked appointment history                                                                                                |
| `/account/addresses`                                         | Saved addresses                                                                                                           |
| `/account/wishlist`                                          | Saved products                                                                                                            |
| `/admin`                                                     | Role-gated operational dashboard                                                                                          |
| `/admin/products`                                            | Product list and bilingual product/image creation                                                                         |
| `/admin/calendar`                                            | Worker-column day calendar, approval queue, moves, time off, and owner-created bookings                                   |
| `/admin/staff`                                               | Worker lifecycle, service assignments, and weekly availability                                                            |
| `/admin/services`, `/admin/collections`, `/admin/categories` | Bilingual service and catalog-group management with images                                                                |
| `/admin/[section]`                                           | Remaining inventory, orders, customers, discounts, reviews, wholesale, newsletter, content, settings, and analytics views |

Catalog, collection, category, service, worker, schedule, time-off, order, and
appointment controls are implemented mutations. Remaining analytics and subscriber
sections are operational read views.

### API and metadata

| Route                                                  | Method           | Purpose                                                       |
| ------------------------------------------------------ | ---------------- | ------------------------------------------------------------- |
| `/api/auth/[...nextauth]`                              | `GET`, `POST`    | Auth.js callbacks/session                                     |
| `/api/register`                                        | `POST`           | Customer registration                                         |
| `/api/password/forgot`, `/api/password/reset`          | `POST`           | Password recovery                                             |
| `/api/availability`                                    | `GET`            | Timezone-aware open appointment slots                         |
| `/api/appointments`                                    | `POST`           | Conflict-safe guest booking                                   |
| `/api/appointments/manage/[token]`                     | `GET`, `DELETE`  | View/cancel via hashed expiring token                         |
| `/api/checkout`                                        | `POST`           | Validate server prices, reserve stock, create Stripe Checkout |
| `/api/stripe/webhook`                                  | `POST`           | Verify and idempotently process Stripe events                 |
| `/api/orders/track`                                    | `POST`           | Rate-limited guest order lookup                               |
| `/api/newsletter`                                      | `POST`           | Newsletter opt-in                                             |
| `/api/inquiries`                                       | `POST`           | Contact and wholesale submissions                             |
| `/api/reviews`                                         | `POST`           | Moderated product-review submission                           |
| `/api/store-state`                                     | `GET`, `PUT`     | Persistent guest/account cart and wishlist                    |
| `/api/admin/cloudinary/signature`                      | `POST`, `DELETE` | Authorized signed upload/deletion                             |
| `/api/admin/cloudinary/upload`                         | `POST`           | MIME- and size-validated image upload                         |
| `/api/admin/content/[...key]`                          | `GET`, `PUT`     | Versioned MongoDB content documents                           |
| `/api/cron/appointment-reminders`                      | `GET`            | Secret-authenticated reminder batch                           |
| `/api/health`                                          | `GET`            | Service configuration readiness                               |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | `GET`            | SEO/PWA metadata                                              |

## Data model

The Prisma schema groups:

- **Identity:** `User`, `Account`, `Session`, `VerificationToken`, `Address`
- **Catalog:** products, translations, images, variants, categories, collections,
  tags, join tables, inventory, and an inventory adjustment ledger
- **Commerce:** carts, wishlists, orders and line snapshots, payments, shipments,
  discounts/redemptions, and moderated reviews
- **Appointments:** services/translations, staff/services, recurring availability,
  business hours, blocked time, buffered appointments, status history, and hashed
  management tokens
- **Operations:** newsletter subscriptions, wholesale applications, typed JSON
  settings, append-oriented audit logs, and idempotent webhook receipts

Money uses PostgreSQL decimal columns; external-facing records retain names, prices,
addresses, and configuration snapshots so later catalog edits do not rewrite history.

## External services

### Stripe

Use test-mode keys locally and forward signed events:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the emitted `whsec_...` value to `STRIPE_WEBHOOK_SECRET`. Enable
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired` in
production. Use Stripe test card `4242 4242 4242 4242` with any future expiry/CVC.

### Cloudinary

Set the three Cloudinary variables. Authenticated administrators can use either the
signed-upload endpoint or the image manager's server-validated upload path. The image
manager accepts JPEG, PNG, WebP, and AVIF files up to 4 MB and never persists them to
the Vercel filesystem. Both EN and ZH alt text are required.

### Resend and Upstash

Verify a Resend sending domain and set `EMAIL_FROM`. Without email configuration,
password recovery is unavailable and transactional sends report as undelivered.
Configure Upstash REST credentials in production. Production startup fails closed
without them; only local development uses the in-memory fallback.

### Optional MongoDB Atlas

MongoDB is intentionally not required for commerce or booking. Leave
`NOSQL_PROVIDER=disabled` until a cluster exists. For a low-cost start, create an
Atlas M0 free shared cluster, set the MongoDB variables, and run:

```bash
npm run nosql:setup
```

This validates the connection and creates unique, lookup, and TTL indexes. Review
free-tier limits and the full [hybrid storage guide](docs/nosql-storage.md) before
using it for production content.

## Appointment configuration

Keep `BUSINESS_TIMEZONE`, `src/config/store.ts`, seeded `StoreSetting` values, and
database schedules aligned. Weekly hours use local minutes-after-midnight;
appointments and blocks are stored as UTC timestamps. Service-specific preparation
buffers are included in conflict checks and the database exclusion range.

Runtime booking lead time, cancellation notice, booking horizon, and default deposit
live in `storeConfig.booking`; `APPOINTMENT_DEPOSITS_ENABLED` can enable deposits per
environment. The availability API currently emits 30-minute slots. When deposits are
enabled, owner acceptance creates a payment hold and Stripe confirmation changes
`PENDING_PAYMENT` to `CONFIRMED`; otherwise owner acceptance confirms immediately.
Unaccepted `PENDING` requests remain publicly open. See
[Workforce calendar and appointment approval](docs/workforce-calendar.md).

Schedule `/api/cron/appointment-reminders` at least hourly and send
`Authorization: Bearer $CRON_SECRET`. Each invocation processes up to 50 due
appointments and retries failures up to three times.

## Quality and debugging

```bash
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Use `npm run db:studio` for local records, `/api/health` for configured-service
readiness, `stripe listen` for webhook diagnostics, and `docker compose logs postgres`
for local database failures. Never paste tokens, customer details, webhook bodies, or
database URLs into issues.

CI in `.github/workflows/ci.yml` installs from the lockfile, validates and generates
Prisma, applies migrations to an isolated PostgreSQL service, and runs typecheck,
lint, unit tests, and the production build.

## Vercel deployment

1. Provision production and preview PostgreSQL databases with SSL and backups.
2. Add all production environment variables to the correct Vercel scopes.
3. Run `npm run db:migrate:deploy` once from a controlled release job.
4. Deploy the application; do not run migrations concurrently in every build.
5. Register `https://YOUR_DOMAIN/api/stripe/webhook` in Stripe.
6. Configure a Vercel Cron for `/api/cron/appointment-reminders`.
7. Verify `/api/health`, both locales, authentication, a test checkout, a booking,
   email delivery, image upload/deletion, and admin authorization.

See [Deployment and operations](docs/deployment-operations.md) for complete setup,
launch, monitoring, backup, and rollback procedures.

## Production launch checklist

- [ ] Replace all Lunaria identity, contact, legal, social, and SEO placeholders
- [ ] Review EN/ZH product, service, guide, policy, and transactional email copy
- [ ] Use unique production secrets and least-privilege service credentials
- [ ] Apply migrations, verify `btree_gist`, seed the initial administrator, then
      remove seed credentials
- [ ] Confirm prices, currency, taxes, shipping, inventory, hours, timezone, buffers,
      cancellation rules, and deposit policy
- [ ] Verify Stripe signatures/events, Cloudinary folder restrictions, Resend domain,
      Upstash rate limiting, and cron authorization
- [ ] Enable managed database backups/PITR and test restore and code rollback
- [ ] Complete privacy/legal review, accessibility checks, responsive testing, and
      both-language journeys
- [ ] Run all CI checks and smoke-test production without using real customer data

## Rollback

Use Vercel’s previous deployment for an application rollback. Treat database
migrations as forward-only: take a backup before destructive changes, ship a
corrective migration, and never run `prisma migrate reset` against shared or
production data. Restore a database only for a declared recovery event, then reconcile
migration state before serving traffic.

## Use as a template

Fork or select **Use this template**, rotate every credential, create new databases
and provider projects, and follow the exact
[brand customization checklist](docs/customization.md). Search the repository for
`Lunaria`, `lunaria`, `Chicago`, `.example`, and `LUN-` before launch.

## Documentation

- [Architecture and security](docs/architecture-security.md)
- [Deployment and operations](docs/deployment-operations.md)
- [Customization checklist](docs/customization.md)

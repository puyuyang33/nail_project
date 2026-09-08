# Deployment and operations

This runbook covers local bootstrap, provider configuration, Vercel deployment,
routine releases, observability, and recovery.

## External accounts

Create separate development/preview and production resources wherever the provider
supports it:

1. **PostgreSQL 17+** — managed, SSL-enabled, automated backups and point-in-time
   recovery recommended.
2. **Vercel** — project connected to the template repository.
3. **Stripe** — test and live API keys plus webhook endpoints.
4. **Cloudinary** — signed image-upload account and restricted upload policy.
5. **Resend** — API key and verified sending domain.
6. **Upstash Redis** — REST-enabled database for distributed rate limiting.
7. **MongoDB Atlas (optional)** — document storage for editable nested content and
   TTL operational events. An M0 cluster can be used while the workload fits its
   free-tier limits.
8. **Google Cloud OAuth** — web client for customer and administrator sign-in.

Require MFA for provider dashboards and use least-privilege team roles. Never reuse
production credentials in preview deployments.

## Environment inventory

Set variables independently for local, Preview, and Production. Values shown here
are names or examples, not deployable credentials.

### Core

| Variable                          | Notes                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | PostgreSQL URL. The running app should use the provider's pooled URL when recommended for serverless; migration jobs need a DDL-capable connection. |
| `NEXT_PUBLIC_APP_URL`             | Exact public origin without a trailing slash, such as `https://nails.example.com`. It is intentionally browser-visible.                             |
| `AUTH_SECRET`                     | Random, unique, 32+ characters. Rotating it invalidates active JWT sessions.                                                                        |
| `AUTH_GOOGLE_ID`                  | Google OAuth web client ID.                                                                                                                         |
| `AUTH_GOOGLE_SECRET`              | Google OAuth client secret; server-only.                                                                                                            |
| `AUTH_GOOGLE_ADMIN_EMAILS`        | Comma-separated trusted administrator emails.                                                                                                       |
| `AUTH_CREDENTIALS_ENABLED`        | Optional password fallback; defaults to `false`.                                                                                                    |
| `BUSINESS_TIMEZONE`               | Valid IANA name, for example `America/Chicago`; never use an abbreviation such as `CST`.                                                            |
| `STORE_CURRENCY`                  | Validated three-letter ISO currency value. Runtime pricing currently reads `src/config/store.ts`; keep them aligned.                                |
| `APPOINTMENT_DEPOSITS_ENABLED`    | Enables Stripe-backed appointment deposits at runtime; defaults to `false`.                                                                         |
| `APPOINTMENT_NOTIFICATION_EMAILS` | Comma-separated owner/front-desk email recipients; falls back to Google admin emails.                                                               |
| `NOSQL_PROVIDER`                  | `disabled` by default; set to `mongodb` only after the document cluster exists.                                                                     |
| `MONGODB_URI`                     | Server-only Atlas/compatible driver URI; required in MongoDB mode.                                                                                  |
| `MONGODB_DATABASE`                | Document database name; defaults to `lunaria`.                                                                                                      |
| `NOSQL_EVENT_RETENTION_DAYS`      | TTL for operational documents; defaults to 90 days.                                                                                                 |

`DIRECT_URL` is accepted by environment validation but is not consumed by the current
`prisma.config.ts`. For a provider that supplies pooled and direct URLs, inject the
direct URL as `DATABASE_URL` only in the controlled migration job and retain the
pooled URL in the Vercel runtime.

### Integrations

| Variable                   | Scope                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`        | Server only; use `sk_test_...` outside production                 |
| `STRIPE_WEBHOOK_SECRET`    | Server only; one value per endpoint/environment                   |
| `CLOUDINARY_CLOUD_NAME`    | Server response includes this non-secret account identifier       |
| `CLOUDINARY_API_KEY`       | Server response includes this non-secret signing identifier       |
| `CLOUDINARY_API_SECRET`    | Server only                                                       |
| `RESEND_API_KEY`           | Server only                                                       |
| `EMAIL_FROM`               | Verified sender, for example `Lunaria <orders@nails.example.com>` |
| `UPSTASH_REDIS_REST_URL`   | Server only                                                       |
| `UPSTASH_REDIS_REST_TOKEN` | Server only                                                       |
| `CRON_SECRET`              | Random, unique, 32+ characters; server only                       |

Vercel production builds fail early when core provider variables are missing.
`NEXT_PUBLIC_APP_URL` and `EMAIL_FROM` are also operationally required even though
the build guard does not currently enforce them.

### Seed only

| Variable                                    | Behavior                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `SEED_ADMIN_EMAIL` (or `ADMIN_EMAIL`)       | Normalized address for the initial admin                               |
| `SEED_ADMIN_PASSWORD` (or `ADMIN_PASSWORD`) | Required 12–72 UTF-8 byte password                                     |
| `SEED_ADMIN_NAME` (or `ADMIN_NAME`)         | Optional display name                                                  |
| `SEED_ADMIN_ROTATE_PASSWORD=true`           | Explicitly replaces an existing seeded admin hash                      |
| `SEED_DEMO_DATA=true`                       | Adds `.test` customer, order, appointment, review, and related samples |

Keep seed credentials in a secret manager or ephemeral shell variables. Remove them
from Vercel after bootstrap. Never enable demo data in production.

### Docker only

`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_PORT` override
Compose defaults. The setup helpers generate a random local password. The checked-in
fallback password is for loopback-only local development and must never be reused.

## Local bootstrap

### Automated

From the repository root:

```bash
# macOS/Linux
SEED_ADMIN_EMAIL="owner@example.com" \
SEED_ADMIN_PASSWORD="use-a-unique-password" \
RUN_SEED=1 sh ./scripts/setup.sh
```

```powershell
# Windows PowerShell
$env:SEED_ADMIN_EMAIL = "owner@example.com"
$env:SEED_ADMIN_PASSWORD = "use-a-unique-password"
.\scripts\setup.ps1 -Seed
```

The helpers:

1. verify Node/npm;
2. create `.env` only if it does not exist;
3. generate random local database, Auth.js, and cron secrets;
4. run `npm ci`;
5. start only the PostgreSQL Compose service and wait for readiness;
6. generate Prisma Client and deploy committed migrations; and
7. seed only when explicitly enabled and credentials are present.

They never overwrite an existing `.env`.

### Manual

```bash
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

Useful local operations:

```bash
docker compose ps
docker compose logs -f postgres
docker compose stop postgres
docker compose down
docker compose down --volumes # destructive: deletes the local database
npm run db:studio
```

## Database lifecycle

### Create a migration

Modify `prisma/schema.prisma`, then:

```bash
npm run db:migrate -- --name describe_the_change
npm run db:generate
npx prisma validate
```

Review generated SQL before committing. Never edit an already-applied migration;
create a corrective migration. `prisma db push` is acceptable only for disposable
prototypes because it bypasses migration history.

The initial migration is followed by hand-authored PostgreSQL integrity migrations.
They install `btree_gist`, add data checks, define the appointment exclusion
constraint Prisma cannot express, and later narrow that constraint so unaccepted
`PENDING` requests remain non-blocking. Preserve the migration sequence.

Verify migration state and the exclusion constraint:

```bash
npx prisma migrate status
psql "$DATABASE_URL" -c \
  "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'Appointment_no_overlapping_active_staff_bookings';"
```

The deployment database principal must be allowed to create the trusted
`btree_gist` extension. If the provider preinstalls extensions through a dashboard,
enable it before `prisma migrate deploy`.

### Seed

```bash
export SEED_ADMIN_EMAIL="owner@example.com"
export SEED_ADMIN_PASSWORD="use-a-unique-password"
npm run db:seed
unset SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD
```

PowerShell equivalent:

```powershell
$env:SEED_ADMIN_EMAIL = "owner@example.com"
$env:SEED_ADMIN_PASSWORD = "use-a-unique-password"
npm run db:seed
Remove-Item Env:SEED_ADMIN_EMAIL, Env:SEED_ADMIN_PASSWORD
```

The seed is idempotent and does not reset existing stock quantities or rotate an
existing admin password by default. Use `SEED_ADMIN_ROTATE_PASSWORD=true` only during
a controlled credential recovery. Prefer an audited admin workflow for later staff
accounts and role changes.

### Production release order

1. Take or verify a recent database backup.
2. Review SQL for locks, table rewrites, and destructive changes.
3. Apply `npm run db:migrate:deploy` exactly once with a DDL-capable connection.
4. Deploy application code compatible with both old and new schema when doing a
   multi-step migration.
5. Run post-deploy smoke tests.
6. Remove temporary migration credentials.

Do not run migrations from every Vercel build; simultaneous deployments can contend
for locks and make rollback unsafe.

The sitemap reads the live catalog during `next build` whenever `DATABASE_URL` is
set, so the target database must already contain the committed schema. Gate a
production deployment behind the one-time migration job (or build a preview first,
run migrations, and promote it) rather than racing migration and build.

## Stripe

### Local test mode

Install the Stripe CLI, authenticate, and start forwarding:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Set the displayed signing secret as `STRIPE_WEBHOOK_SECRET`, set a test
`STRIPE_SECRET_KEY`, and restart the development server. Complete checkout with
`4242 4242 4242 4242`, any future expiry, and any CVC/postal code.

The application handles:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Checkout Sessions expire after 30 minutes. A successful event captures the
reservation in an inventory transaction; failed/expired events release it. Duplicate
Stripe event IDs return successfully without repeating side effects.

Useful diagnostics:

```bash
stripe trigger checkout.session.completed
stripe logs tail
```

The generic trigger has no Lunaria metadata, so it is useful for signature/receipt
diagnostics but may intentionally end in a handled application error. Exercise a real
test Checkout Session for the end-to-end order flow.

### Production

Create an endpoint at:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

Subscribe only to the four event types above. Store the endpoint-specific live
signing secret in Vercel Production. Confirm that retries return `2xx` after an event
has already been recorded. Monitor `WebhookEvent` rows with `FAILED` status and
replay only after correcting the underlying problem.

## Cloudinary

1. Create a dedicated product environment/cloud.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
   `CLOUDINARY_API_SECRET`.
3. Restrict the Cloudinary account/upload policy to images, the expected folder,
   JPEG/PNG/WebP/AVIF, and a maximum of 4 MB.
4. Log in with an administrator role and create a product with EN and ZH alt text.
5. Verify upload, order, primary-image selection, rendering, and deletion.

The signing endpoint never returns the API secret. Image bytes go from the browser
to Cloudinary, not through Vercel's temporary filesystem. Database rows store the
secure URL, public ID, dimensions, ordering, primary status, and localized alt text.

When renaming the Cloudinary folder, update both `storeConfig.cloudinaryFolder` and
the deletion allowlist in
`src/app/api/admin/cloudinary/signature/route.ts`. A mismatch permits uploads but
prevents safe deletion.

## Resend

1. Verify the production sending domain and configure SPF/DKIM/DMARC.
2. Create environment-specific API keys.
3. Set `EMAIL_FROM` to an address on the verified domain.
4. Test order confirmation, booking confirmation, reminder, and password reset.
5. Monitor bounces/complaints and define suppression handling before marketing sends.

Missing Resend configuration causes `sendEmail` to return an explicit non-delivery
result. Password recovery fails with `503`; order/appointment records remain
persisted and indicate that confirmation delivery is pending.

## Upstash and abuse protection

Create a regional Redis database close to the Vercel functions and set the REST URL
and token. Verify that repeated registration/password, booking, tracking, contact,
newsletter, and wholesale requests receive `429`.

The fallback limiter is per-process and resets when an instance is replaced. It is
not a production control. Add Vercel Firewall/WAF limits for Auth.js credential
sign-in, webhook request volume, and obvious automated traffic. Stripe signature
verification remains mandatory even behind a firewall.

## Appointment operations

### Configuration sources

- `BUSINESS_TIMEZONE` controls parsing and display conversion.
- `src/config/store.ts` controls booking lead time, cancellation notice, default
  deposit, deposit enablement, and public business details.
- `Service` controls duration, service-specific deposit, and before/after buffers.
- `BusinessHours`, `StaffAvailability`, and `BlockedTime` control bookable slots.
- Seeded `StoreSetting` rows mirror template configuration but are not yet the
  runtime source.

Use one IANA timezone throughout. If it changes, update the environment, store
config, seed settings, public copy, and existing future schedules deliberately.
Existing UTC appointments must not be blindly reinterpreted.

The availability endpoint currently generates slots every 30 minutes and applies the
lead time and booking horizon from `storeConfig.booking`.

### Deposits

Deposit behavior is enabled by `APPOINTMENT_DEPOSITS_ENABLED=true` or the typed
`storeConfig.booking.depositEnabled` default. When enabled:

1. the customer submits a non-blocking `PENDING` request;
2. the owner accepts it and the slot becomes a `PENDING_PAYMENT` hold;
3. Stripe Checkout collects the service or default deposit;
4. a verified webhook confirms the appointment and creates a management token; and
5. an expired/failed session marks the appointment expired.

Test successful, failed, abandoned, duplicate-webhook, and concurrent-booking paths
before enabling deposits.

### Reminders

The reminder handler accepts authenticated `GET` requests and processes 50 confirmed
appointments per invocation. Failed sends are delayed 30 minutes and retried up to
three times.

Add this configuration to a root `vercel.json` if the project does not already
manage cron schedules elsewhere:

```json
{
  "crons": [
    {
      "path": "/api/cron/appointment-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` for configured cron requests.
For a manual check, supply that header from a secure shell without recording the
secret in history. Never place the secret in the URL.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Keep the framework preset as Next.js and use `npm run build`.
3. Set all variables in Production; use isolated provider resources and test keys in
   Preview.
4. Run migrations from a controlled release workflow or trusted workstation.
5. Deploy only after migrations succeed, then attach the custom domain.
6. Update `NEXT_PUBLIC_APP_URL`, Auth.js/Stripe origins, webhook endpoint, and
   provider allowlists to the canonical HTTPS domain.
7. Configure the reminder cron.
8. Turn on deployment protection for previews containing private test data.
9. If MongoDB is enabled, run `npm run nosql:setup` once per environment and verify
   the content and TTL indexes in Atlas.

Docker is local-development infrastructure only and is not used by Vercel.

### Post-deploy verification

- [ ] `GET /api/health` reports expected service readiness without exposing secrets
- [ ] `/en` and `/zh` render and locale switching preserves the current page
- [ ] Canonical, alternate-language, Open Graph, sitemap, robots, and manifest URLs
      use the production origin
- [ ] Customer registration/login/reset and role redirects behave correctly
- [ ] Guest checkout reaches Stripe test/live mode as intended
- [ ] Webhook completion updates payment/order and inventory exactly once
- [ ] Order tracking requires matching contact information
- [ ] Availability respects hours, blocks, staff schedules, timezone, and buffers
- [ ] Two concurrent bookings cannot reserve the same staff/range
- [ ] Pending requests stay publicly open until an administrator accepts one
- [ ] Owner, customer, and worker appointment emails reach the intended inboxes
- [ ] Guest cancellation rejects expired/invalid links and late cancellations
- [ ] Resend emails contain correct HTTPS links
- [ ] Cloudinary upload and deletion work only for authorized roles
- [ ] Upstash and firewall limits return `429` under abuse tests
- [ ] Admin pages reject customers and anonymous visitors

## Monitoring and routine maintenance

Monitor:

- Vercel function errors and latency by route;
- Stripe webhook delivery failures and `WebhookEvent.status = FAILED`;
- appointments with exhausted reminder attempts;
- old `PENDING_PAYMENT` orders/appointments and stranded inventory reservations;
- Resend bounces/complaints;
- Cloudinary usage;
- Upstash errors/limit volume;
- MongoDB connections, storage, TTL index health, and document-store errors when enabled;
- PostgreSQL connections, storage, locks, slow queries, and backup success.

Run regularly:

```bash
npm audit
npx prisma migrate status
npm run typecheck
npm run lint
npm test
npm run build
```

Dependency updates are proposed by Dependabot. Review major Prisma, Next.js, Auth.js,
Stripe, and date/time changes against their migration guides.

## Backup and rollback

### Before a release

- Verify automated backup/PITR status and retention.
- Take a manual restore point before destructive or high-lock migrations.
- Record the deployed commit and migration names.
- Prefer expand/migrate/contract schema changes so the prior application remains
  temporarily compatible.

### Application rollback

Promote the last known-good Vercel deployment. If the new migration was additive,
leave it applied and ship a forward fix. Rotate any credential exposed by the failed
release.

### Database recovery

Do not run `prisma migrate reset`, delete migration rows, or manually reverse SQL in
production. For a faulty migration:

1. stop or protect writes if data integrity is at risk;
2. preserve logs and create a fresh backup;
3. determine whether a forward corrective migration is safe;
4. restore to a new database only when forward repair is not possible;
5. validate record counts, money totals, inventory reservations, appointments, and
   migration state; and
6. switch traffic only after smoke testing.

Use `prisma migrate resolve` only when the database change and migration history are
already understood and reconciled; it does not execute or undo SQL.

## Troubleshooting

| Symptom                                             | Checks                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma command targets the local fallback database  | Set `DATABASE_URL` explicitly before migrations, seeding, or Studio; generation alone needs no live database                                                      |
| `Cannot find module '.prisma/client/default'`       | Run `npm run db:generate`; current installs also run this automatically through `postinstall`                                                                     |
| Local PostgreSQL rejects a newly generated password | An existing named volume keeps its original credentials; restore the old `.env` or, for disposable data only, run `docker compose down --volumes` and rerun setup |
| App shows demo catalog                              | Confirm `DATABASE_URL` is set in the running environment and redeploy                                                                                             |
| Database connection exhaustion                      | Use the provider's serverless pooler and inspect adapter/pool limits                                                                                              |
| Migration cannot create `btree_gist`                | Enable it through the database provider, then rerun deploy                                                                                                        |
| Stripe checkout works but order stays pending       | Verify endpoint secret, subscribed events, metadata, and failed `WebhookEvent` rows                                                                               |
| Inventory remains reserved                          | Inspect expired/failed webhook delivery and reconcile the affected order transactionally                                                                          |
| Booking displays unexpected time                    | Compare IANA timezone, host clock, stored UTC instants, and schedule minutes                                                                                      |
| No reminder email                                   | Check `nextReminderAt`, status, attempts, token expiry, cron authorization, and Resend                                                                            |
| Image deletion is rejected                          | Ensure the public ID begins with the allowed folder prefix                                                                                                        |
| Rate limits differ between requests                 | Configure Upstash; the local fallback is instance-local                                                                                                           |
| Static content never changes after an admin edit    | Set `NOSQL_PROVIDER=mongodb`, verify `MONGODB_URI`, run `npm run nosql:setup`, and publish the document                                                           |

# Architecture and security

This document describes the implemented boundaries and the assumptions operators
must preserve. It is not a substitute for a threat model or legal review for a
specific deployment.

## System shape

Lunaria is a single Next.js App Router application deployed as serverless functions
and React Server Components. There is no long-running application process and no
production dependency on local disk.

```text
Public browser
  │
  ├── localized pages (next-intl)
  ├── public route handlers
  └── Auth.js endpoints
         │
         ├── PostgreSQL through Prisma 7 / @prisma/adapter-pg
         ├── Stripe API and signed webhook callbacks
         ├── Cloudinary signed or server-validated uploads
         ├── Resend email API
         └── Upstash Redis REST API

Vercel Cron
  └── authenticated reminder route ── Resend
```

### Application layers

| Layer              | Location                                    | Responsibility                                                                 |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Routes and layouts | `src/app`                                   | Rendering, metadata, route handlers, and server actions                        |
| Interactive UI     | `src/components`                            | Forms, cart state, image manager, and reusable storefront controls             |
| Domain functions   | `src/features`                              | Pricing, appointment calculations, and request schemas                         |
| Service adapters   | `src/lib`                                   | Prisma, Auth.js helpers, Stripe, email, tokens, normalization, and rate limits |
| Runtime defaults   | `src/config/store.ts`                       | Brand, locale, currency, booking, shipping, and feature defaults               |
| Localized content  | `messages/*.json`, `src/data/content.ts`    | Interface strings and editorial content                                        |
| Persistence        | `prisma/schema.prisma`, `prisma/migrations` | Relational model and database-enforced invariants                              |

When `DATABASE_URL` is absent, catalog readers use the in-repository demo catalog
and the availability endpoint returns demonstration slots. Mutations requiring
persistence call `requireDatabase()` and fail closed. Production must always set a
database URL.

## Data model

### Identity

- `User` stores normalized identity, optional bcrypt password hash, locale, role,
  status, and last-login time.
- `Account`, `Session`, and `VerificationToken` support the Auth.js Prisma adapter.
  Password-reset records store a SHA-256 token hash, never the bearer token.
- `Address` belongs to a user. Orders copy address data into JSON snapshots instead
  of depending on a mutable saved address.

Auth.js currently uses the credentials provider and JWT session strategy. The
database session table remains available for adapter compatibility or a future
session-strategy change.

### Catalog and inventory

- `Product`, `ProductVariant`, and `ProductImage` define sellable items.
- `ProductTranslation`, `CategoryTranslation`, `CollectionTranslation`, and
  `TagTranslation` use locale rows, so another locale does not require a new column.
- Explicit join models retain ordering and provide stable many-to-many relations.
- `Inventory` uses `quantityOnHand`, `quantityReserved`, and a `version` counter.
  `InventoryAdjustment` is the append-oriented stock ledger.

Checkout selects prices and availability from PostgreSQL. Browser-submitted prices
are discarded. Inventory is reserved with an optimistic version check before a
Stripe Checkout Session is created. A successful verified webhook converts the
reservation into a sale; failed or expired Checkout Sessions release it.

### Commerce

- `Cart` supports user ownership or a hashed guest session token; `CartItem` keeps a
  display-price snapshot but is not authoritative at checkout.
- `Wishlist` similarly supports account or guest ownership.
- `Order` and `OrderItem` contain immutable customer, address, shipping, product,
  variant, SKU, image, customization, and money snapshots.
- `Payment` records provider identifiers, idempotency keys, status, and sanitized
  provider metadata. Card details remain with Stripe.
- `Shipment` retains the shipping-address snapshot and tracking state.
- `Discount`, scope joins, and `DiscountRedemption` support bounded use.
- `Review` supports verified-purchase linkage and moderation.

### Scheduling

- `Service` contains duration, price, deposit, and preparation buffers;
  `ServiceTranslation` contains localized presentation.
- `StaffService` declares which artists perform each service.
- `BusinessHours` and `StaffAvailability` store local minutes after midnight.
- `BlockedTime`, appointment instants, and reminder times are stored as PostgreSQL
  `timestamptz`.
- `Appointment` snapshots contact, service, price, duration, timezone, location, and
  the buffered reservation range.
- `AppointmentStatusHistory` provides a state audit trail.
- `AppointmentManagementToken` stores only a SHA-256 token hash and expiry.

The booking route first checks hours, staff rules, blocks, and conflicts, then repeats
the conflict check inside a serializable transaction. The
`Appointment_no_overlapping_active_staff_bookings` PostgreSQL exclusion constraint is
the final concurrency boundary. It rejects intersecting `[reservedStartAt,
reservedEndAt)` ranges for the same staff member while status is `PENDING`,
`PENDING_PAYMENT`, `CONFIRMED`, or `IN_PROGRESS`. Adjacent bookings are valid.

Any code that catches a database conflict should return a generic “slot no longer
available” response rather than leaking other appointment details.

### Operations

- `NewsletterSubscription` tracks consent and lifecycle status.
- `WholesaleApplication` separates applicant data from review data.
- `StoreSetting` stores typed JSON configuration records.
- `AuditLog` captures actor, action, entity, before/after summaries, and request
  metadata without requiring a mutable target relation.
- `WebhookEvent` uniquely identifies provider events and stores a payload hash,
  processing state, attempt count, and scrubbed result—not the full webhook payload.

`src/config/store.ts` is currently the runtime source for most storefront settings;
seeded `StoreSetting` records provide persistence and an administration surface.
Keep both aligned until runtime settings are loaded from the database.

## Trust boundaries and controls

### Browser input

All browser input is untrusted:

- Public route handlers parse values with Zod.
- Checkout fetches products, variants, inventory, and prices server-side.
- Appointment duration, price, buffers, staff, and timezone come from trusted
  configuration/database records.
- Order tracking requires both the order number and a matching normalized contact.
- Error responses avoid returning another customer's contact or order details.

Client-side validation improves usability only. Do not move authorization, price
calculation, stock checks, or appointment checks into client components.

### Authentication and authorization

- Credentials are compared with bcrypt hashes.
- Public registration always assigns `CUSTOMER`; it cannot choose a role.
- `requireUser` protects account pages.
- `requireAdmin` permits only `ADMIN` and `SUPER_ADMIN` and protects admin
  layouts/actions. `STAFF` is reserved for future scoped permissions.
- Cloudinary signing and deletion repeat authorization inside their route handlers.
- There is no public administrator registration path.

Every new admin route handler or server action must call `requireAdmin` itself.
Protecting only a parent layout is not sufficient for an independently callable
mutation.

### Tokens and secrets

- Use at least 32 random characters for `AUTH_SECRET` and `CRON_SECRET`.
- Guest-management and password-reset bearer tokens are randomly generated; only
  SHA-256 hashes are persisted.
- Appointment links expire and are revoked after cancellation.
- Password-reset links expire after one hour and are deleted after use.
- Provider secrets must remain server-only. Never prefix them with `NEXT_PUBLIC_`.
- Do not log raw tokens, cookies, authorization headers, webhook payloads, addresses,
  phone numbers, or full email addresses.

### Stripe

The webhook route reads the raw request body and validates `stripe-signature` before
doing database work. `(provider, externalEventId)` is unique, so retries are
idempotent. Order/payment/inventory changes use serializable transactions.

Only Stripe event IDs, object IDs, hashes, and scrubbed processing results are
persisted. Do not store complete event payloads without a documented retention and
access policy.

### Uploads

The image manager sends files through an authorized server route that verifies the
actual MIME type and enforces a 4 MB limit before streaming to Cloudinary. A separate
authorized signature endpoint supports trusted direct-upload clients. Production
Cloudinary configuration must also enforce allowed resource types, formats, size,
and folder. Keep the deletion route's `lunaria/` public-ID prefix guard aligned with
the configured folder.

### Rate limiting

Upstash supplies distributed sliding-window limits:

| Bucket                                   | Limit                     |
| ---------------------------------------- | ------------------------- |
| Registration/password operations         | 8 requests per 10 minutes |
| Checkout                                 | 10 per 10 minutes         |
| Booking and guest appointment management | 8 per 10 minutes          |
| Order tracking                           | 12 per 10 minutes         |
| Contact/newsletter                       | 5 per 10 minutes          |
| Wholesale                                | 3 per 30 minutes          |

Without Upstash, an in-memory fallback is used only for local development. Production
configuration fails closed when the shared limiter is absent. Credential sign-in,
registration, password operations, booking, tracking, contact, wholesale, and
newsletter submission all use application-level limits; a Vercel Firewall remains a
recommended additional layer.

## Privacy and retention

The schema intentionally keeps fulfillment and service snapshots. Define and
automate retention periods before launch:

| Data                               | Suggested policy decision                                     |
| ---------------------------------- | ------------------------------------------------------------- |
| Orders/payments/shipments          | Retain for tax, chargeback, and statutory periods             |
| Appointments and contact snapshots | Minimize after the support/legal window                       |
| Password and management tokens     | Delete expired/revoked rows on a schedule                     |
| Webhook events                     | Retain status metadata only as long as incident support needs |
| Audit logs                         | Restrict access; define a fixed security/compliance window    |
| Newsletter and wholesale records   | Honor withdrawal and deletion obligations                     |

Never use production personal data in preview environments or support tickets.
Restrict database, Stripe, Resend, and Cloudinary dashboards with MFA and
least-privilege team membership.

## Security change checklist

Before merging a sensitive change:

- [ ] Authorization is performed in the mutation, not only in navigation or layout
- [ ] Input is parsed and bounded server-side
- [ ] Prices and permissions come from trusted server state
- [ ] Multi-record writes use an appropriate transaction/isolation level
- [ ] A retry cannot duplicate payment, inventory, order, email, or webhook effects
- [ ] Responses and logs contain no secrets or unrelated customer data
- [ ] Tokens are random, hashed at rest, scoped, expiring, and revocable
- [ ] New public endpoints have rate limiting and abuse controls
- [ ] Database constraints back critical invariants
- [ ] EN/ZH validation and error behavior remain understandable
- [ ] Tests cover the success, unauthorized, conflict, retry, and failure paths

Report suspected vulnerabilities privately through GitHub private vulnerability
reporting or the repository owner's documented security contact. Do not open a public
issue containing exploit details, credentials, or customer information.

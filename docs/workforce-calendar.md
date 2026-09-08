# Workforce calendar and appointment approval

Lunaria schedules nail services like a small clinic: customers request a service,
worker, date, and time; the studio owner reviews the request; only an accepted
appointment blocks that worker's public availability.

## Status workflow

```text
Customer request
      │
      ▼
   PENDING ───────────────► CANCELED (declined/customer canceled)
      │ admin accepts
      ├─ deposits off ────► CONFIRMED ─► IN_PROGRESS ─► COMPLETED
      └─ deposits on ─────► PENDING_PAYMENT ─► CONFIRMED
                                      └──────► EXPIRED/CANCELED
```

`PENDING` deliberately does not block availability. Several customers may request
the same open slot; the first request accepted by an administrator wins. Acceptance
rechecks the worker's service eligibility, recurring schedule, time off, studio
hours, and accepted appointments inside a serializable transaction. The PostgreSQL
exclusion constraint is the final race-condition boundary.

These statuses block the public calendar:

- `PENDING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`

Pending, rejected, canceled, expired, completed, and no-show records do not make a
future slot appear busy.

## Admin workflow

### Team calendar

Open `/{locale}/admin/calendar`.

- Navigate one day at a time.
- Review pending requests for that day.
- Select or change the worker before accepting.
- Decline requests without consuming a slot.
- View accepted appointments in worker columns and 30-minute rows.
- Move an appointment to another worker/time.
- Start, complete, or cancel accepted work.
- Create a confirmed appointment on behalf of a phone/walk-in customer.
- Mark a worker unavailable for an interval and remove the block later.

Time-off creation refuses to cover an already accepted appointment. Reassign or
cancel that appointment first.

### Workers

Open `/{locale}/admin/staff`.

- Add and edit worker name, email, phone, and bio.
- Assign the services each worker can perform.
- Add or remove recurring weekly availability.
- Retire/reactivate a worker.

Retirement is soft: historical records remain. A worker with future blocking
appointments cannot be retired until those appointments are reassigned or canceled.

### Catalog and service management

- `/admin/products`: create bilingual products, variants, inventory, images, and
  category/collection assignments.
- `/admin/collections`: create/deactivate bilingual collections and cover images.
- `/admin/categories`: create/deactivate bilingual product categories.
- `/admin/services`: create/update/deactivate bilingual services, images, durations,
  buffers, deposits, and worker assignments.

## Customer booking

The booking page displays a privacy-safe worker matrix. Each cell is only:

- **Open** — can be requested.
- **Busy** — an accepted appointment/payment hold already occupies the interval.
- **Off** — outside the worker schedule or covered by approved time off.

No customer name, service notes, phone, or email is exposed publicly. Selecting an
open cell chooses that worker and time. The request remains pending until the studio
owner accepts it.

## Notifications

Set one or more comma-separated recipients:

```dotenv
APPOINTMENT_NOTIFICATION_EMAILS=owner@gmail.com,frontdesk@example.com
```

If this is empty, the app uses `AUTH_GOOGLE_ADMIN_EMAILS`. Resend delivers:

- a new-request email to owners with a direct team-calendar link;
- request-received and accept/decline emails to customers;
- assignment emails to workers with a Google Calendar link;
- confirmation/reminder/cancellation messages.

Gmail mobile notifications provide a no-cost phone notification path once the owner
enables notifications in the Gmail app. SMS remains intentionally behind a future
provider abstraction and should not be enabled without consent and opt-out handling.

The Google Calendar link is explicit rather than automatic API synchronization. This
avoids requesting broad Calendar OAuth scopes from every customer or worker. A future
sync provider can consume the same accepted appointment records.

## Deposits

When deposits are disabled, owner acceptance immediately changes the request to
`CONFIRMED`.

When deposits are enabled, acceptance:

1. transactionally moves the request to `PENDING_PAYMENT`, blocking the slot;
2. creates a Stripe Checkout Session;
3. emails the customer a payment link;
4. changes to `CONFIRMED` only after a verified Stripe webhook.

Expired or declined payment holds release the public slot.

## Database migration

Migration `20260908213000_pending_approval_availability` changes the exclusion
constraint so `PENDING` requests may overlap while accepted/payment-held records may
not. Apply it before using the approval workflow:

```bash
npm run db:migrate:deploy
```

## Operational checks

- Verify owner and worker email addresses before enabling notifications.
- Keep every active worker's services and weekly hours current.
- Review pending requests daily; the dashboard displays their count.
- Add holidays as global `BlockedTime` records and personal leave as worker records.
- Test daylight-saving boundaries in the configured business timezone.
- Never expose appointment contact information in public availability responses.

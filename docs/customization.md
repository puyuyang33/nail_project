# Customize this template

Use this checklist for every new nail business. Complete it before connecting live
payments or accepting customer data.

## Safe fork workflow

1. Create a private working repository from the template.
2. Create new development/preview/production provider resources; never share the
   template author's credentials or databases.
3. Run the local setup script and verify the unmodified baseline.
4. Make brand/content changes, then catalog/scheduling changes.
5. Run the repository-wide search and validation commands at the end of this guide.
6. Obtain business approval for prices, policies, contact details, and translations.
7. Complete the launch checklist in
   [Deployment and operations](deployment-operations.md).

Do not delete the existing migration history merely to rename the store. Database
table names are intentionally brand-neutral.

## Exact file and setting checklist

### Repository identity

- [ ] `package.json`: change `name` to a lowercase npm-safe project name. Run
      `npm install --package-lock-only` so `package-lock.json` stays synchronized.
- [ ] GitHub repository Settings: update name, description, topics, visibility,
      template-repository status, branch protection, Actions permissions, and private
      vulnerability reporting.
- [ ] `README.md` and `docs/**`: replace the store name, example domain, support
      process, policies, and provider-specific operating notes.
- [ ] `.github/SECURITY.md`: replace the placeholder private security contact and
      confirm supported-version policy.
- [ ] `.github/CODEOWNERS`: add real GitHub users/teams if the file is introduced;
      require review for `.github/workflows/**`, `prisma/**`, and authentication code.

### Brand, contact, and runtime behavior

- [ ] `src/config/store.ts`: update `name`, `shortName`, `description`, canonical
      `url`, `currency`, default/supported locales, timezone, contact details, social
      links, displayed business hours, announcement, booking policy, shipping
      methods, feature flags, and `cloudinaryFolder`.
- [ ] `src/app/layout.tsx`: update default/title-template metadata, description, and
      the `next/font` families or weights.
- [ ] `src/app/[locale]/layout.tsx`: update organization/NailSalon JSON-LD street,
      locality, region, postal code, country, contact, and social profiles.
- [ ] `src/app/manifest.ts`: update application name/short name through config and
      review `start_url`, background color, theme color, icon path, and sizes.
- [ ] `next.config.ts`: add or remove approved remote image hosts in
      `images.remotePatterns`.
- [ ] `src/app/robots.ts` and `src/app/sitemap.ts`: confirm private paths, canonical
      host, locale alternates, dynamic URLs, priorities, and indexing policy.
- [ ] `src/app/globals.css`: replace color tokens, shadows, radius, and any branded
      visual texture; recheck contrast in every state.
- [ ] `public/lunaria-mark.svg`: replace the logo mark and rename/update references if
      desired.
- [ ] `src/app/icon.svg` and `public/lunaria-mark.svg`: replace favicon and app
      icon artwork.
- [ ] `src/components/site/header.tsx` and `src/components/site/footer.tsx`: review
      navigation, visible wordmarks, social links, contact copy, and footer policies.
- [ ] `src/components/store/store-provider.tsx`: change the local-storage namespace
      so carts/wishlists cannot collide with another deployment on the same origin.

### Languages and content

- [ ] `src/i18n/routing.ts`: set locale codes, default locale, URL-prefix policy, and
      rename the `lunaria-locale` cookie.
- [ ] `src/i18n/request.ts` and `src/i18n/navigation.ts`: verify locale loading and
      typed navigation after changing the locale list.
- [ ] `messages/en.json` and `messages/zh.json`: replace every visible interface
      string and metadata string; add a complete message file for every new locale.
- [ ] `src/data/content.ts`: replace About, Contact, FAQ, wholesale, sizing,
      application/removal, shipping, returns, privacy, and terms copy in every locale.
- [ ] `src/data/demo.ts`: replace fallback products, collections, services,
      testimonials, images, alt text, price, options, and availability examples.
- [ ] `src/app/[locale]/page.tsx`: review homepage editorial copy, campaign content,
      structured sections, and embedded brand references.
- [ ] `src/app/[locale]/[...content]/page.tsx`: replace the hard-coded information
      sidebar label if the brand changes.
- [ ] `src/app/[locale]/collections/[slug]/page.tsx`: replace collection-specific
      branded copy.
- [ ] `src/app/[locale]/error.tsx` and `src/app/[locale]/not-found.tsx`: verify both
      languages and support links.

Translations are stored as locale rows for products, categories, collections, tags,
and services. Add every required locale row before publishing an item. Do not silently
fall back to English for legal or safety copy.

### Database seed and identifiers

- [ ] `prisma/seed.ts`: replace all product, category, collection, tag, service,
      staff, business-hour, blocked-time, StoreSetting, image, alt-text, SKU, price,
      stock, and location fixtures.
- [ ] `prisma/seed.ts`: replace seeded brand/contact values and the inactive
      `WELCOME10` demonstration discount; decide whether to remove it entirely.
- [ ] `prisma/seed.ts`: keep all demonstration addresses on reserved `.test`
      domains and leave `SEED_DEMO_DATA` disabled in production.
- [ ] `prisma/schema.prisma`: review currency precision, country/contact fields,
      statuses, retention requirements, and custom metadata before live data exists.
      Create migrations for schema changes.
- [ ] `prisma/migrations/20260907210500_integrity_constraints/migration.sql`: keep the
      appointment exclusion constraint and ensure active statuses still match the
      application's active-status list.
- [ ] `prisma/migrations/20260908213000_pending_approval_availability/migration.sql`:
      preserve the rule that pending requests do not block until owner acceptance.
- [ ] `src/app/api/checkout/route.ts`: replace the `LUN-` order-number prefix if
      branded references should change.
- [ ] `src/app/api/appointments/route.ts`: replace the `LUN-A` appointment prefix and
      keep active statuses synchronized with the database exclusion constraint.
- [ ] Tests containing sample service slugs, times, prefixes, or timezone values:
      update expected values rather than weakening assertions.

Run the seed first against a disposable database. Inspect all rows with Prisma Studio
before using it in production.

### Catalog, pricing, shipping, and tax

- [ ] Confirm every variant's SKU, options, size/shape/length/finish, price,
      compare-at price, weight, stock, and reorder threshold.
- [ ] Confirm product/category/collection/tag associations and EN/ZH SEO fields.
- [ ] Replace Unsplash placeholders with owned or appropriately licensed assets.
- [ ] Review `storeConfig.shippingMethods`; its server-side values are used during
      checkout.
- [ ] Implement jurisdiction-appropriate tax calculation before launch. The current
      checkout calculation passes tax as zero.
- [ ] Define fulfillment, return, hygiene, customization, international shipping,
      duties, and refund policies with qualified business/legal review.
- [ ] Keep the three-letter currency aligned across `storeConfig`, environment,
      database seed, Stripe price data, and display copy.

### Appointments

- [ ] Set one IANA business timezone in `BUSINESS_TIMEZONE`,
      `src/config/store.ts`, and seeded localization settings.
- [ ] Replace displayed business hours in `src/config/store.ts`.
- [ ] Replace persisted `BusinessHours`, `StaffAvailability`, and `BlockedTime`
      fixtures in `prisma/seed.ts`.
- [ ] Set service duration and before/after buffers; verify the reservation range
      stays within both business and staff hours.
- [ ] Review `leadTimeHours`, `cancellationHours`, deposit amount, and feature flags
      in `storeConfig.booking`.
- [ ] Configure `APPOINTMENT_NOTIFICATION_EMAILS` and worker email addresses.
- [ ] Review the approval queue, worker-column calendar, and time-off workflow in
      `docs/workforce-calendar.md`.
- [ ] Review the configured lead time, booking horizon, and the availability API's
      30-minute interval.
- [ ] Review the configured guest cancellation cutoff and policy copy.
- [ ] Decide whether deposits are enabled; keep
      `APPOINTMENT_DEPOSITS_ENABLED`, `storeConfig.booking.depositEnabled`, service
      deposit values, and customer-facing policy text consistent.
- [ ] Configure reminder cadence and update appointment `nextReminderAt` creation if
      reminders should be sent at a different offset.
- [ ] Add holidays, breaks, preparation time, and each artist's service eligibility.
- [ ] Test daylight-saving transitions and simultaneous bookings in the business
      timezone.

Do not edit future appointment timestamps merely because the displayed business
timezone changes. Plan and communicate a real rescheduling migration.

### Integrations and secrets

- [ ] Create new Stripe, Cloudinary, Resend, Upstash, PostgreSQL, and Vercel resources.
- [ ] Decide whether flexible content needs MongoDB. If so, create an Atlas project,
      configure the four NoSQL variables, and run `npm run nosql:setup`.
- [ ] Set distinct Preview and Production environment variables.
- [ ] Generate new `AUTH_SECRET` and `CRON_SECRET`.
- [ ] Create a Google OAuth web client, configure exact local/production callback
      URLs, and set the administrator email allowlist.
- [ ] Register the canonical Stripe webhook and only required events.
- [ ] Verify the Resend sender domain and replace brand names in `src/lib/email.ts`.
- [ ] Change the Upstash key prefix `lunaria:` in `src/lib/rate-limit.ts`.
- [ ] Change `storeConfig.cloudinaryFolder` and the `lunaria/` deletion guard in
      `src/app/api/admin/cloudinary/signature/route.ts` together.
- [ ] Review Cloudinary upload restrictions, transformations, moderation, and
      retention.
- [ ] Configure Vercel Cron and validate its bearer authorization.
- [ ] Remove all seed/admin credentials after bootstrap.

### Transactional text and system identifiers

The brand appears outside central configuration where transactional copy or stable
namespaces require explicit review:

- [ ] `src/lib/email.ts`: appointment, reminder, order, and reset-email branding.
- [ ] `src/app/api/password/forgot/route.ts`: password-reset subject/body.
- [ ] `src/lib/rate-limit.ts`: Redis key namespace.
- [ ] `src/lib/db.ts`: development global-client key and fallback database name.
- [ ] `src/i18n/routing.ts`: locale cookie name.
- [ ] `src/app/api/checkout/route.ts`: order reference prefix.
- [ ] `src/app/api/appointments/route.ts`: appointment reference prefix.
- [ ] `prisma/seed.ts`: seeded business and example records.
- [ ] `docker-compose.yml` and `scripts/setup.*`: local database defaults.

Changing an existing order or appointment prefix affects only newly generated
references. Do not rewrite historical references after launch.

## Verification

Search for every template-specific value:

```bash
rg -n -i "lunaria|luma|chicago|armitage|555|example\\.test|LUN-" \
  src messages prisma README.md docs .github scripts docker-compose.yml package.json
```

Then run:

```bash
npm run db:generate
npx prisma validate
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Finally test both desktop and mobile:

- [ ] Browse, search, filter, cart, and checkout in English and Chinese
- [ ] Switch languages without losing the current page
- [ ] Register, sign in, reset a password, and use account pages
- [ ] Track a guest order with correct and incorrect contact data
- [ ] Book with email only and phone only
- [ ] Reject blocked, outside-hours, lead-time, and overlapping bookings
- [ ] Cancel with a valid management link and reject expired/reused links
- [ ] Upload, reorder, select, and delete product images
- [ ] Confirm customers cannot reach admin reads or mutations
- [ ] Verify sitemap, robots, manifest, canonical URL, locale alternates, and JSON-LD
- [ ] Review all policies, prices, addresses, email links, and provider dashboards

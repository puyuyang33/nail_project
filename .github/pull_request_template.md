## Summary

<!-- What changed, and why is this the smallest complete solution? -->

## User-visible changes

<!-- Include affected routes and EN/ZH behavior. Write "None" when applicable. -->

## Validation

<!-- List exact commands and manual journeys run. -->

- [ ] `npm run db:generate`
- [ ] `npx prisma validate`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`

## Screenshots

<!-- Required for visual changes. Include desktop/mobile and both locales when relevant. -->

N/A

## Data and deployment

<!-- Describe migrations, backfills, environment changes, cron/provider changes, and rollback. -->

- Migration/backfill: None
- Environment/provider changes: None
- Rollback plan: Revert the application change

## Risk review

- [ ] Authorization is enforced inside every new protected mutation.
- [ ] Prices, permissions, and appointment availability come from trusted server state.
- [ ] Retries are idempotent and multi-record writes are transactional.
- [ ] Logs, fixtures, screenshots, and errors contain no secrets or customer data.
- [ ] New public endpoints include validation and abuse protection.
- [ ] Accessibility and keyboard behavior were checked.
- [ ] English and Simplified Chinese behavior was checked.
- [ ] Documentation and operational runbooks were updated.

## Reviewer notes

<!-- Call out areas needing special attention or follow-up. -->

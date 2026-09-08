# Google authentication

Google OAuth is the default customer and administrator sign-in method. Visitors do
not create or manage a separate Lunaria password. Auth.js stores the Google account
link in PostgreSQL and uses a signed JWT session.

Google OAuth itself does not require a paid Google Cloud service for ordinary
authentication. Review Google's current OAuth quotas and consent-screen policies
before production launch.

## Create Google credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Open **Google Auth Platform** and configure Branding, Audience, and Data Access.
4. Choose an Internal audience only if every user belongs to the same Google
   Workspace. A public customer store normally needs External.
5. While the consent screen is in Testing, add the Google accounts that may test it.
6. Create an OAuth client with application type **Web application**.
7. Add these authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://YOUR_PRODUCTION_DOMAIN`
8. Add these authorized redirect URIs exactly:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_PRODUCTION_DOMAIN/api/auth/callback/google`
9. Copy the client ID and client secret into local/Vercel environment variables.

Redirect URIs are exact and include no locale segment.

## Environment

```dotenv
AUTH_SECRET=replace-with-at-least-32-random-characters
AUTH_GOOGLE_ID=123456789-example.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=replace-with-google-client-secret
AUTH_GOOGLE_ADMIN_EMAILS=owner@example.com

# Disabled by default: no public password accounts
AUTH_CREDENTIALS_ENABLED=false
AUTH_PASSWORD_REGISTRATION_ENABLED=false
```

Google sign-in also requires `DATABASE_URL` because Auth.js persists `User`,
`Account`, and related records through the Prisma adapter.

Generate `AUTH_SECRET` locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Never expose the Google client secret with a `NEXT_PUBLIC_` prefix.

## Customer account behavior

- The first successful Google sign-in creates a `CUSTOMER` user automatically.
- Returning users sign in through the linked Google `Account`; no Lunaria password is
  stored.
- Google must provide a verified email address.
- Guest checkout and guest appointment booking continue to work without login.
- When the verified Google email matches previous guest orders or appointments, those
  unclaimed records are linked to the new account automatically.

## Administrator access

Put trusted Google addresses in the comma-separated
`AUTH_GOOGLE_ADMIN_EMAILS` allowlist:

```dotenv
AUTH_GOOGLE_ADMIN_EMAILS=owner@example.com,manager@example.com
```

An allowlisted verified Google account receives the `ADMIN` role. Existing
`SUPER_ADMIN` users are never downgraded.

Google is configured as a trusted verified-email provider, so it may link to an
existing seeded user with the same normalized email. Use only addresses controlled
by the intended administrator and protect the Google accounts with MFA.

## Optional password fallback

Password sign-in remains available only as an explicit operational fallback:

```dotenv
AUTH_CREDENTIALS_ENABLED=true
AUTH_PASSWORD_REGISTRATION_ENABLED=false
```

This exposes the password form but keeps public registration disabled. Set
`AUTH_PASSWORD_REGISTRATION_ENABLED=true` only if the business intentionally wants
standalone password accounts. Password recovery is unavailable while credential
authentication is disabled.

## Local verification

1. Start PostgreSQL and apply migrations.
2. Set the Google variables in `.env`.
3. Restart `npm run dev`.
4. Open <http://localhost:3000/en/login>.
5. Choose a Google account and confirm Google returns to
   `/api/auth/callback/google`, then `/en/account`.
6. For an allowlisted email, verify `/en/admin` is accessible.
7. For a normal customer, verify `/en/admin` redirects to the account page.

## Troubleshooting

| Symptom                                  | Resolution                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch`                  | Copy the exact callback URI above into the Google OAuth client                                    |
| Google button is disabled                | Configure `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`, then restart |
| Consent screen blocks the user           | Add the account as a test user or publish/verify the External app as required                     |
| User signs in but cannot open admin      | Add the normalized email to `AUTH_GOOGLE_ADMIN_EMAILS`, restart, and sign in again                |
| Existing seeded admin is not linked      | Ensure its email exactly matches the verified Google email                                        |
| Auth.js reports an account-linking error | Confirm only the trusted Google provider is linking and that the email is verified                |

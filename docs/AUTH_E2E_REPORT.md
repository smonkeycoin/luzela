# Auth E2E Report

Date: 2026-08-11
Project: Luzela Shop
Supabase project ref: hegljvvrqztbjavwvdzo
Vercel project: luzela

## Summary

Google OAuth cannot be completed end-to-end yet. The local app has Supabase public config and `SUPABASE_SECRET_KEY` configured, but the Luzela Supabase Auth logs report `provider is not enabled` for Google OAuth `/authorize`.

## Implemented

- `/auth/login` renders a Google OAuth button.
- Browser login calls Supabase `signInWithOAuth` with provider `google`.
- OAuth `redirectTo` points to `/auth/callback` on the current origin.
- `/auth/callback` exchanges the PKCE code server-side.
- Authenticated users are checked against `public.admin_users`.
- Non-admin users are signed out and sent to `/auth/access-denied`.
- `/admin/*` is protected server-side.
- Backend Supabase admin client prefers `SUPABASE_SECRET_KEY` and falls back to `SUPABASE_SERVICE_ROLE_KEY`.

## Supabase Auth Configuration Needed

Site URL:

```txt
https://luzela.mx
```

Redirect URLs:

```txt
http://localhost:3001/auth/callback
https://luzela.mx/auth/callback
https://www.luzela.mx/auth/callback
```

Google provider:

```txt
external_google_enabled = true
external_google_client_id = from Google Cloud OAuth Client
external_google_secret = from Google Cloud OAuth Client
```

## Google Cloud Configuration Needed

Authorized JavaScript origins:

```txt
http://localhost:3001
https://luzela.mx
https://www.luzela.mx
```

Authorized redirect URI:

```txt
https://hegljvvrqztbjavwvdzo.supabase.co/auth/v1/callback
```

## Admin Allowlist

`public.admin_users` has 0 rows right now. The first owner must sign in once with Google, then be inserted using the resulting `auth.users.id`.

## Verification

- Supabase public config: configured
- Supabase server secret: configured
- Google OAuth real: fail
- Session exchange: fail
- Auth user created: no
- First owner created: no
- Owner role: none
- Owner admin access: fail
- Unauthorized account blocked: not tested
- Session refresh: fail
- Logout: fail for authenticated session; anonymous logout route works
- Google Provider enabled: fail in Auth logs
- Next.js login route: pass
- Next.js callback route: pass for missing-code redirect; real OAuth exchange not tested
- Admin allowlist: implemented
- Unauthorized admin access: pass for anonymous `/admin` redirect
- Local Google OAuth: not tested
- Vercel Auth env: missing
- Secret exposure audit: safe
- Auth users count: 0
- Admin users count: 0

## Blocking Evidence

Supabase Auth logs for project `hegljvvrqztbjavwvdzo` show:

```txt
2026-08-11T16:32:06Z /authorize 400 provider is not enabled
2026-08-11T16:30:10Z /authorize 400 provider is not enabled
2026-08-11T16:28:07Z /authorize 400 provider is not enabled
```

Because no Google OAuth user was created, no first owner row was inserted.

## Vercel Auth Env Audit

Project `luzela` is missing:

```txt
APP_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SECRET_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

## Test Runs

```txt
npm run lint: pass
npm run test: pass
npm run build: pass
npx playwright test: pass, 7 passed
```

## Remaining Manual Action

Enable the Google Provider in Supabase project `hegljvvrqztbjavwvdzo` itself, confirm the Google Client ID and Client Secret are saved there, then retry Google sign-in. Add the missing Auth env vars to Vercel project `luzela` before any production auth test.

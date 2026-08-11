# Auth Implementation

Status: implemented locally, pending real Google/Supabase provider credentials.

## Flow

Luzela Shop sends users to Supabase Auth, Supabase sends them to Google, Google returns to Supabase, and Supabase redirects back to:

```txt
http://localhost:3001/auth/callback
https://luzela.mx/auth/callback
https://www.luzela.mx/auth/callback
```

The app callback exchanges the PKCE code with `exchangeCodeForSession(code)` and then checks `admin_users` before redirecting to `/admin`.

## Routes

- `/auth/login`: renders the Google OAuth login button.
- `/auth/callback`: exchanges the Supabase Auth code and persists the session cookie.
- `/auth/access-denied`: shown when a Google user is authenticated but not allowlisted.
- `/admin/*`: protected server-side by `admin_users`.

## Admin Allowlist

Admin authorization uses `admin_users`, not Google profile metadata.

Required row:

```txt
admin_users.user_id = auth.users.id
admin_users.active = true
admin_users.role in owner/admin/operations/readonly
```

If a user signs in with Google but is not active in `admin_users`, the app signs them out and shows access denied.

## First Owner Procedure

There is intentionally no public admin signup flow and no invented owner email in seed data.

1. Enable Google in the Luzela Supabase project.
2. Sign in once with the real owner Google account.
3. In Supabase, find that account in `auth.users`.
4. Insert the matching row in `public.admin_users`:

```sql
insert into public.admin_users (user_id, email, role, active)
values ('AUTH_USER_ID_FROM_SUPABASE', 'owner@example.com', 'owner', true);
```

Use the real `auth.users.id` and real owner email. Do not preauthorize by editable Google metadata.

## Environment

Frontend/browser:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Backend/server:

```txt
SUPABASE_SECRET_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` remains supported only as a legacy fallback for local compatibility.

## Security Notes

- Google Client Secret is configured only in Supabase, not in Next.js.
- Supabase secret/service-role key is not exposed to frontend code.
- `NEXT_PUBLIC_*` contains only public URL/key values.
- `/admin` protection is server-side and does not rely on hiding UI.
- No public admin signup flow exists.

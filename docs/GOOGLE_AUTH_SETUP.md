# Google Auth Setup

## Google Cloud

Go to:

```txt
Google Cloud project
Google Auth Platform
Clients
Web application
```

## Authorized JavaScript Origins

```txt
http://localhost:3001
https://luzela.mx
https://www.luzela.mx
```

## Authorized Redirect URI

Use Supabase Auth callback as the Google redirect URI:

```txt
https://hegljvvrqztbjavwvdzo.supabase.co/auth/v1/callback
```

Do not use `https://luzela.mx/auth/callback` directly as the Google redirect URI.

## Supabase Provider

Configure Google in:

```txt
Supabase
Authentication
Providers
Google
```

Add the Google Client ID and Client Secret there. Do not commit or paste the Client Secret into this repository.

## Supabase URL Configuration

Set production Site URL:

```txt
https://luzela.mx
```

Add Redirect URLs:

```txt
http://localhost:3001/auth/callback
https://luzela.mx/auth/callback
https://www.luzela.mx/auth/callback
```

Add a temporary Vercel Preview callback only when it is needed for testing. Avoid broad production wildcards.

## Current Status

- Google Client ID: not available in this workspace.
- Google Client Secret: not configured through available tools.
- Supabase Google provider: pending manual Dashboard configuration.
- Supabase Site URL and Redirect URLs: expected values documented above; Dashboard verification still required.

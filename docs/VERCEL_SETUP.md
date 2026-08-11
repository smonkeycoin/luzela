# Vercel Setup

## CLI

Verified locally:

```txt
Vercel CLI: 54.9.0
Authenticated user: trinopc1-9400
```

## Local Link Status

This folder is linked to the existing Vercel project `luzela`.

```txt
Project name: luzela
Project ID: prj_9B1AfeWR7sZfXjy4yt0TYhSY34kz
Org/team ID: team_LG4vLJ75SnXcNtNqKI61bIj9
Owner/scope: Neuro Practice's projects
```

## Resolution Evidence

```txt
luzela
  ID: prj_9B1AfeWR7sZfXjy4yt0TYhSY34kz
  Owner: Neuro Practice's projects
  Framework preset: Other
  Latest production URL: https://luzela.vercel.app
```

Known deployment match:

```txt
https://luzela-ftkdnvyp4-neuro-practice-s-projects.vercel.app
deployment id: dpl_44QKipvGUZDyj9UbrZVG3c1k5AsB
project/deployment name: luzela
target: production
status: Ready
created: 2026-07-09
```

Aliases:

```txt
https://luzela.mx
https://www.luzela.mx
https://luzela.vercel.app
https://luzela-neuro-practice-s-projects.vercel.app
https://luzela-git-main-neuro-practice-s-projects.vercel.app
```

Brand Experience separation verified:

```txt
about.luzela.mx -> luzelaexperience
```

Do not link Luzela Shop to `shop`, `luzelaexperience`, or `luzelalanding`.

## Required Link Command

Executed:

```txt
vercel link --yes --project luzela
```

Do not run `vercel --prod` yet.

## Current Framework Setting

Vercel currently reports `Framework Preset: Other` for project `luzela`. The local app is Next.js 16 and `npm run build` succeeds. Update the Vercel project framework preset to Next.js before deployment if Vercel does not auto-detect from this linked repository.

## Expected Environment Names

Compare Vercel environment names against:

```txt
APP_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
RESEND_FROM
```

Report only configured/missing. Do not print secret values.

Current Vercel env result:

```txt
No environment variables configured in project luzela.
```

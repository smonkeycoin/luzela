# Luzela Commerce OS

Independent commerce engine for Luzela. This project does not modify `/Users/smonkeycoin/Desktop/luzelalanding`.

## Sprint 0

Built:

- Next.js 16 App Router shell.
- Mobile-first checkout shell.
- Admin dashboard shell at `/admin`.
- Stripe webhook route with signed-event boundary.
- Supabase client boundaries for public/server and service-role usage.
- Supabase schema draft in `supabase/schema.sql`.
- Architecture docs in `docs/`.
- Sprint 0 delivery summary in `docs/SPRINT_0_DELIVERY.md`.
- `.env.example` without real credentials.

Not built yet:

- Live Stripe checkout.
- Live Supabase connection.
- Product CRUD mutations.
- Order fulfillment actions.
- Resend sending.
- Vercel deployment.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run lint
npm run build
```

## Key Rule

The browser redirect never marks an order as paid. Only a verified Stripe webhook can move an order into `paid`.

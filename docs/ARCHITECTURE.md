# Luzela Commerce OS Architecture

Sprint 0 creates the operating foundation, not the full store.

## Principle

- Stripe charges money.
- Supabase stores operational truth.
- Luzela Admin operates products, orders, customers, inventory and settings.
- The frontend never decides that an order is paid.
- Only a signed Stripe webhook can confirm payment.
- Important writes must be idempotent and audited.

## Runtime Shape

- `src/app/page.tsx`: commerce entry shell with brand assets.
- `src/app/checkout`: mobile-first guest checkout shell.
- `src/app/admin`: protected admin shell placeholder for Supabase Auth.
- `src/app/api/checkout`: future server-side checkout creation endpoint.
- `src/app/api/stripe/webhook`: signed webhook boundary.
- `src/lib/supabase`: browser-safe server client and service-role admin client.
- `src/lib/stripe`: Stripe SDK boundary and webhook event router.
- `supabase/schema.sql`: V1 database design.

## External Services

- Supabase: Postgres, Auth, RLS, Storage later for product images.
- Stripe: Checkout Sessions for one-time purchases, using API version `2026-07-29.dahlia`.
- Resend: transactional email after order/payment/shipping events.
- Vercel: deployment target after Sprint 1 hardening.

## Security Posture

- No real credentials are committed.
- Service role is server-only.
- Product price is read server-side from Supabase.
- Webhooks use raw body verification.
- RLS is enabled on all public tables.
- Data API grants are explicit because new Supabase projects may not expose tables automatically.

# Sprint 1 Final E2E Report

Date: 2026-08-11

## Infrastructure

- Supabase Luzela: connected
- Stripe mode: Test only
- Stripe Live used: no
- Stripe CLI listener: real local listener
- Local webhook endpoint: `http://localhost:3001/api/stripe/webhook`
- Auth/admin owner: pass
- Luzela Experience modified: no
- Vercel touched: no

## Env Audit

- `SUPABASE_SECRET_KEY`: configured
- `STRIPE_SECRET_KEY`: configured
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: configured
- `STRIPE_WEBHOOK_SECRET`: configured with fresh listener secret
- `APP_URL`: `http://localhost:3001`
- `RESEND_API_KEY`: missing

## Test Order

- Customer email: `cliente-test+luzela-003@example.com`
- Order number: `LZ-A914643E79`
- Order ID: `b3787171-9ad4-4cc2-a991-216cd139c796`
- Product: `Luzela SPF 50+ - Individual`
- SKU: `LUZ-SPF50-IND`
- Quantity: 1
- Total: MXN 710.00
- Initial variant stock before paid webhook: 25
- Final variant stock after paid webhook: 24

## Checkout Evidence

- Customer created: yes
- Address created: yes
- Order created as `pending_payment`: yes
- Order item correct: yes
- Checkout session stored: yes
- Payment identifiers stored after webhook: yes

## Webhook Evidence

- Signed webhook received: yes
- `checkout.session.completed` persisted in `payment_events`: yes
- Order transitioned to `paid`: yes
- `paid_at` set: yes
- Success URL did not mark order paid by itself: confirmed

## Inventory Evidence

- `inventory_movements` includes exactly one `sale` movement for the paid order.
- Sale quantity delta: `-1`
- Duplicate webhook replay returned 200 and did not create a second movement.
- Stock decremented exactly once: 25 to 24.

## Admin Evidence

- `/admin/orders` shows the paid order.
- Order detail shows customer, address, item, total, Stripe Checkout Session, Stripe Payment Intent, payment row count, inventory movement, and timeline.

## Failure Cases

- Payment failure: pass after adding PaymentIntent metadata mapping.
- Stock insufficient: pass, returned 409 `insufficient_stock`.
- Refresh success page: pass, no paid transition or inventory duplication.
- Duplicate webhook: pass.
- Refund: not executed; refund handling exists for `charge.refunded`, but inventory return behavior is not implemented in Sprint 1.

## Email

`RESEND_API_KEY` is missing, so paid checkout did not block and created:

```txt
email_event.status = skipped
template_key = payment_confirmed
```

## Bugs Found And Fixed

- Catalog stock read bug: Supabase returned `inventory` as an object for this relationship, while the app expected an array. Fixed catalog stock normalization.
- Payment failure mapping bug: `payment_intent.payment_failed` could not map to its order because Checkout metadata was not copied to the PaymentIntent. Fixed with `payment_intent_data.metadata` and handler fallback by metadata order ID.
- Operational listener issue: a background `stripe listen` process exited with the shell and missed events. Fixed by running a persistent listener session before the valid paid E2E.

## Test Runs

```txt
npm run test: pass, 4/4
npm run lint: pass
npm run build: pass
npx playwright test: pass, 7/7
```

## Sprint 2.1 Pack Inventory Addendum

The SUMMER catalog now uses commercial pack variants over the single physical `LUZ-SPF50-IND` inventory pool.

Latest validation:

```txt
npm run test: pass, 9/9
npm run lint: pass
npm run build: pass
npx playwright test: pass, 20/20
Stripe Test 1X: paid, SALE -1
Stripe Test 2X: paid, SALE -2
Stripe Test 3X: paid, SALE -3
Stripe Test 2 x 3X: paid, SALE -6
Duplicate signed webhook: no second movement, no second decrement
```

See `docs/SPRINT_2_1_PACK_INVENTORY_REPORT.md`.

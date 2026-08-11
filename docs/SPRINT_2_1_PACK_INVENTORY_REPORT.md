# Sprint 2.1 Pack Inventory Report

Date: 2026-08-11

## Scope

Implemented the approved narrow Commerce Engine change for commercial pack variants backed by one physical Luzela inventory pool.

No Auth, admin authorization, Google, Vercel, Luzela Experience, refund restock, or Stripe price ID architecture was changed.

## Implementation

- Physical pool: `LUZ-SPF50-IND`
- Commercial variants:
  - `LUZ-SUMMER-1X`: 1 physical unit per pack, MXN 390.00
  - `LUZ-SUMMER-2X`: 2 physical units per pack, MXN 650.00
  - `LUZ-SUMMER-3X`: 3 physical units per pack, MXN 890.00
- Availability derives from physical stock:
  - 1X: `floor(stock / 1)`
  - 2X: `floor(stock / 2)`
  - 3X: `floor(stock / 3)`
- Checkout snapshots:
  - commercial variant
  - pack quantity
  - `units_per_pack`
  - `physical_units`
  - `inventory_variant_id`
- Webhook fulfillment decrements `physical_units` via `confirm_paid_order`.

## Migration

Applied to Supabase project `luzela-commerce`:

```txt
20260811185757_pack_inventory_engine.sql
```

Local placeholder migrations were added for already-applied remote Sprint 1 migration versions so Supabase CLI history remains aligned without replaying old DDL.

## Remote Verification

Remote stock after migration, before Sprint 2.1 paid E2E:

```txt
LUZ-SPF50-IND physical stock: 24
SUMMER 1X available packs: 24
SUMMER 2X available packs: 12
SUMMER 3X available packs: 8
```

The old public offers remain preserved but archived:

```txt
LUZ-SPF50-IND: archived
LUZ-SPF50-DUO: archived
luzela-spf-50: archived
luzela-duo: archived
```

## Stripe Test E2E

Stripe CLI listener used:

```txt
stripe listen --events checkout.session.completed,payment_intent.succeeded,payment_intent.payment_failed,charge.refunded --forward-to localhost:3001/api/stripe/webhook
```

Webhook signing secret was refreshed locally and Next.js was restarted before payment tests.

### Paid Orders

| Case | SKU | Pack Quantity | Units Per Pack | Physical Units | Sale Movement |
| --- | --- | ---: | ---: | ---: | ---: |
| 1X | `LUZ-SUMMER-1X` | 1 | 1 | 1 | -1 |
| 2X | `LUZ-SUMMER-2X` | 1 | 2 | 2 | -2 |
| 3X | `LUZ-SUMMER-3X` | 1 | 3 | 3 | -3 |
| 2 x 3X | `LUZ-SUMMER-3X` | 2 | 3 | 6 | -6 |

Physical stock moved from 24 to 12 after the four paid E2E orders.

## Idempotency

Replayed a signed duplicate `checkout.session.completed` event for the 2 x 3X order.

Result:

```txt
HTTP 200
SALE movements for order: 1
Movement quantity_delta: -6
Physical stock after duplicate: 12
Duplicate payment_event row: none
```

## Failure Cases

Stock insufficient test:

```txt
SUMMER 3X quantity 5
Physical units required: 15
Physical stock available: 12
Response: 409 insufficient_stock
Message: Only 4 packs are available.
```

## QA

```txt
npm run lint: pass
npm run test: pass, 9/9
npm run build: pass
npx playwright test: pass, 20/20
```

Playwright verifies SUMMER catalog rendering, cart UX, traveling bottle chapters, reduced motion fallback, and mobile overflow.

## Observations

- Stripe Checkout Test page displays account label `PILULA`. Keys are Test Mode and server-side generated items/prices were correct for Luzela, but the account label should be reviewed before production.
- Some paid orders produced duplicate `email_events` with `status = skipped` when both `payment_intent.succeeded` and `checkout.session.completed` arrived close together. Fulfillment and inventory remained idempotent; email emission should be idempotency-guarded before enabling a real Resend key.

## Re-Lock

Commerce Engine is re-locked after this approved physical pack inventory change.

# Production pricing sync and Chavolines 3X

The live catalogue reads `public.product_variants` in Supabase project `hegljvvrqztbjavwvdzo`. Vercel's production `NEXT_PUBLIC_SUPABASE_URL` points to that project. Prices are read at request time by `getActiveProducts` / `getCheckoutProduct`; home is dynamic. No global cache change, fallback catalogue, fixed Stripe Price ID or payment link was required.

| SKU | Product ID | Variant ID | Previous effective MXN | New MXN | Per unit MXN |
| --- | --- | --- | ---: | ---: | ---: |
| LUZ-SUMMER-1X | 5fb8e7a7-061c-42a3-b403-959f35bfba16 | 193a1b97-0cc7-45bf-b4cd-84092a2a8ab8 | 390 | 459 | 459 |
| LUZ-SUMMER-2X | 1151c9a4-d4fe-4f1b-b4a3-60e5b8d0c93b | 5967228b-715e-4f35-b6d8-a664547124ea | 650 | 769 | 384.50 |
| LUZ-SUMMER-3X | 50b2c86f-fe94-45dd-a514-1061daa5b6d1 | 5585efae-a6b2-4462-8ca7-707881a030c6 | 690 | 819 | 273 |

3X previously used a base of 890 and an active 690 offer. The new 819 is its regular price. Included shipping, product/variant IDs, SKUs and physical bundle composition are unchanged.

## Applied database migration

`20260911011625_pricing_18_private_chavolin.sql` was applied to the real project and verified by direct database reads. Exact row-count assertions protect its targeted updates: 3 variants, 3 product text records, 1 collaborator and 1 coupon. Two existing collaboration functions are replaced; no inventory or order update is executed. Fingerprints before/after matched for all 15 orders, 15 order items, 2 inventory records, other variant prices, IDs, shipping flags and bundle composition.

The public-source migration resolves the private code from the existing sole coupon of this collaborator; the executed SQL used the equivalent explicitly verified private value. The initial V1 seed now takes its value from `current_setting('luzela.private_collab_code', true)` so the real private value is never checked into this public repository. Isolated SQL tests supply a fictitious test code. Do not rerun historical migrations or blindly push every local migration: older remote migration versions predate this release's aligned history.

## Private coupon and payment amounts

The private 10% code remains in Supabase. It applies to all three SUMMER variants and produces 413.10 / 692.10 / 737.10 MXN. Wholesale remains excluded. The public UI has a generic empty input and does not disclose, suggest or derive the code from links, referrals or analytics.

For a single pack with included shipping, the cart can validate the customer's manually entered code through the existing server endpoint. A short-lived same-tab handoff carries only that explicit selection into checkout, which revalidates it. The input is never prefilled from a campaign or URL. Quantity edits revalidate the quote; removal restores the full price. The existing one-product checkout remains unchanged for mixed carts.

Orders freeze coupon, campaign `CHAVOLIN`, source `El Mundo en Pareja`, collaborators `Chava & Nat`, subtotal, discount and total. Reporting requires a paid, non-cancelled redemption in the new campaign; older public/automatic experiment orders remain intact and excluded. The previous public distribution of this same code still limits causal attribution of later purchases.

Mercado Pago's existing order route converts the server payment row's `amount_cents` and sends that amount to the Orders API. The Brick, provider route, reconciliation, webhook and inventory code were not edited in this release. Stripe's existing dynamic line item receives the same final amount. No live payment is needed for verification.

## 3X composition

Only the SUMMER 3X card adds “EL FAVORITO / DE LOS / CHAVOLINES” in a reserved upper-right band. Two low-opacity coral/pink cayena SVG watermarks sit in the UI layer. The original bottle asset and product-image component are unchanged. SUMMER DEAL, teal price, included shipping and CTA remain visible. The decoration is static and aria-hidden.

## Reproducible checks

- `npm run test`: checkout amounts with/without coupon for each pack and both providers; provider payload amounts; explicit code transfer restrictions.
- `npm run test:collab-db`: actual SQL in isolated PostgreSQL, including old-to-new price transition, RLS, immutable history and financial attribution.
- `npm run lint` and `npm run build`.
- Set the private `E2E_COLLAB_CODE` only in local/CI secret configuration, then run Playwright public suites `chavolines-feature`, `collab`, `storefront`, `attribution` and `public-trust`. Use `PLAYWRIGHT_BASE_URL` for a production build or the real production URL. These suites do not make live payments or real order submissions.
- Screenshots stay in ignored `docs/qa/`; checkout screenshots can contain the customer's manually entered private code and must not be pushed to this public repository.

The release commit includes previously uncommitted application foundations required to reproduce the current working shop. Local PDFs, authentication state, credentials, unrelated pending database scripts, audit captures and backups are excluded. Deployment must use the pushed commit from a clean checkout and the production environment, never the prior local fixture build.

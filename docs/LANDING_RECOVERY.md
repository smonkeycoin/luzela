# LUZELA landing recovery

## Verified baseline

- Last canonical commit: `d14f6320e9b7d122bc0f5bcb4fc96016d44979cf`.
- Commit timestamp: 2026-09-25 19:17:17 −05:00.
- Vercel production deployment: `dpl_7EpgKYQCVRqJ2o9pg8AotZ8Qx19K`, READY.
- Deployment created: 2026-09-26 00:20:47.376 UTC.
- Deployment URL: https://luzela-2cl1rwdbj-neuro-practice-s-projects.vercel.app
- Before-recovery production: `5772e3c3ce2b17d84276261d754cb30829c7f671`, deployment `dpl_7MjTstaja8gToRdDJNWuF9gLtNiM`.
- Destructive landing changes began in `a6f984f3fa38102159cc80c8b2611ffc4f001ee0`; `ca2107c` and `5772e3c` followed.

Git ancestry and Vercel deployment metadata agree. The baseline's historical alias list is historical evidence; it does not mean that deployment still serves the current production alias.

## Preservation inventory

| Item in canonical release | Change in Summer Drop release | Recovery treatment |
| --- | --- | --- |
| Header: LUZELA México, Tienda, Nuestra historia, FAQ, cart, mobile menu | Unchanged | Preserve |
| Hero: SUMMER LUZELA; Más Luzela. Más días bajo el sol.; mineral SPF 50+ description; Summer Packs and story links; real bottle and beach image | Replaced with Summer Drop pricing and PAGA 2 / RECIBE 3; sizing changed | Restore canonical source, copy, imagery, links and hierarchy |
| Six mineral / origin / lifestyle benefits | Unchanged | Preserve |
| VISTO EN ribbon and official El Mundo en Pareja logo | Still present in source; not deleted | Preserve and verify visibly |
| SUMMER 1X, 2X and 3X shop | 2X filtered out; three columns reduced to two; 3X promoted | Restore all three options and canonical responsive ordering; retain temporary 3X offer |
| 3X “EL FAVORITO DE LOS CHAVOLINES” badge | Removed | Deliberately do not restore: unsupported endorsement prohibited by current brief |
| Four named reviews: Marcel, Azu, Ana K., Ale G. | Unchanged, governed by existing publicReviewsEnabled setting | Preserve the four reviews and feature flag |
| DEL CARIBE A TU RUTINA DIARIA editorial story, texture photo and story link | Unchanged | Preserve |
| VERANO FOREVER collaboration feature, official photo/logo and link | Unchanged | Preserve independently of Summer Drop; no campaign endorsement |
| Footer: Comprar, Luzela, Ayuda, copyright and Mercado Pago | Unchanged | Preserve |
| Funnel, attribution and checkout events | Extended for Summer Drop | Preserve; add dedicated route recognition |
| Catalog prices and server promotion | $819 gross / $50 discount / $769 net implemented server-side | Preserve |
| Payment, inventory, email, admin, collaboration auth/dashboard and RLS | Backend improvements in current release | Preserve current code and database; no rollback |

Canonical content count: seven main sections (hero, benefits, ribbon, shop, reviews, editorial story, collaboration feature), plus header and footer. Six editorial entries: four review quotes, one brand story, one collaboration story. The baseline has no separate blog/article listing to recover. The catalog has three intended Summer pack options. Every canonical section remains in its original relative order; one Summer Drop module is inserted between ribbon and shop.

## Changed files from canonical release to pre-recovery production

```
src/app/admin/analytics/funnel/page.tsx
src/app/admin/orders/[orderId]/page.tsx
src/app/api/checkout/route.ts
src/app/api/mercadopago/order/route.ts
src/app/checkout/page.tsx
src/app/page.tsx
src/app/summer-drop/page.tsx
src/components/add-to-cart-button.tsx
src/components/cart-view.tsx
src/components/funnel-route-tracker.tsx
src/components/shop-section.tsx
src/lib/admin/funnel.ts
src/lib/analytics/client.ts
src/lib/attribution/index.ts
src/lib/catalog/get-active-products.ts
src/lib/catalog/get-checkout-product.ts
src/lib/catalog/summer-drop-allocation.test.ts
src/lib/catalog/summer-drop.test.ts
src/lib/catalog/summer-drop.ts
src/lib/checkout/create-checkout-session.test.ts
src/lib/checkout/create-checkout-session.ts
src/lib/email/send-order-confirmed.ts
src/lib/email/templates/order-confirmation.ts
src/lib/payments/confirm-paid-order.ts
src/lib/payments/reconcile-payment.ts
supabase/migrations/20261002090000_summer_drop_allocation.sql
```

## Campaign links

- Story 01: https://www.luzela.mx/summer-drop?utm_source=instagram&utm_medium=organic_social&utm_campaign=summer_drop&utm_content=story_01
- Story 02: https://www.luzela.mx/summer-drop?utm_source=instagram&utm_medium=organic_social&utm_campaign=summer_drop&utm_content=story_02
- Feed: https://www.luzela.mx/summer-drop?utm_source=instagram&utm_medium=organic_social&utm_campaign=summer_drop&utm_content=feed_launch

## Implementation and preservation result

The canonical home and product selector were reconstructed from the verified last-good source before applying the campaign integration. Hero, navigation, benefits, VISTO EN / El Mundo en Pareja, four reviews, brand story, collaboration story and footer: **PASS**. Seven canonical sections and six editorial entries remain; the one added campaign section follows the ribbon and precedes the shop. All **three** pack options remain, including 2X.

Summer Drop uses the approved real `bottle.webp` asset in a three-bottle composition. Home has one editorial campaign module; `/summer-drop` is a dedicated conversion page. The hero is brand-first. No new Chavolines endorsement was introduced. The old unsupported favorite badge is intentionally absent.

Pricing is preserved server-side: 1X $459, 2X $769, 3X regular $819; active Summer Drop is $819 gross − $50 discount = **$769 MXN**, shipping $0. CHAVOLIN stacking is blocked; acquisition and collaboration attribution remain available. Campaign presentation ends when the existing server allocation is unavailable.

The campaign route records `view_campaign` with `campaign=summer_drop`. Bare internal visits retain prior acquisition credit and the original Chavolines touch. Instagram Story 01, Story 02 and feed attribution have explicit unit coverage. Cart totals now render the existing campaign discount correctly.

No changes to payment services, Mercado Pago API routes, checkout creation/checkout pages, emails, inventory logic, admin, auth, collaboration services or Supabase migrations. A path-scoped diff against `5772e3c` is empty for those areas. No schema changes or measurement reset were made.

## Pre-deployment validation

| Check | Result |
| --- | --- |
| Unit tests | PASS — 127 tests / 29 files |
| Collaboration database regression | PASS — RLS, Google identity conditions, immutable history, reporting, pricing and unpaid-order exclusion |
| TypeScript | PASS — `npx tsc --noEmit` |
| Lint | PASS — zero errors; two existing unused-argument warnings in checkout test fixtures |
| Production build | PASS — Next.js 16.3.0, webpack |
| Public Playwright suite | PASS — 40 tests in one final run |
| Dedicated Mercado Pago smoke | PASS — Card Brick ready, secure iframes present, no payment submitted |
| CHAVOLIN | PASS — 1X/2X manual code; 3X non-stacking; attribution preserved |
| Google Auth | PASS — UI handoff, collaborator destination cookie and callback; live provider returns HTTP 302 to accounts.google.com |
| Collaboration dashboard | PASS within automated scope — access guards and database reporting/RLS; signed-in human Google session not exercised |
| Home / shop / campaign visual audit | PASS at 1440px and 390px, compared with exact last-good deployment captures |
| Catalog preservation | PASS — 1X, 2X, 3X, real assets, readable pricing, no horizontal overflow |

The obsolete test requiring an unsupported Chavolines endorsement and a stackable 3X discount was replaced by canonical-content preservation, truthful campaign treatment and non-stacking checks. Other historical assertions were updated to the already-authorized Summer Drop price.

During early QA, one local catalog request returned the existing unavailable state. The same source subsequently passed the complete 40-test regression and both viewport checks; no catalog fallback or backend behavior was weakened to hide it. Stale browser assertions and an image-locator TypeScript annotation were corrected before the final passing run.

Authenticated admin Playwright projects require credentials not supplied in the environment and were not run. No claim is made that a real collaborator completed Google sign-in during this task. Existing auth/dashboard code remains unchanged.

## QA cleanup and observability

- All browser automation is marked QA by the existing webdriver detection, with explicit `funnel_qa=1` on campaign/payment runs.
- Four checkout attempts were created across the original and final commerce smoke runs. All were QA-marked, stopped before card entry/submission, cancelled, and expired. Internal unpaid payment stubs were closed with `qa_cancelled`; no provider payment IDs or provider orders existed.
- Inventory remains **189 SPF50 units and 15 units of the other physical variant**.
- Campaign allocation remains **25 total / 0 paid / 0 reserved / 25 available** after cleanup.
- `FUNNEL_MEASUREMENT_START` remains **2026-09-26T00:21:27.032+00:00**; its original created/updated timestamps are unchanged.
- Real persisted QA events include campaign view, add to cart, cart view, begin checkout, checkout creation and payment-page view. Analytics failure was deliberately simulated; cart and Card Brick still worked.
- Payment performed: **NO**.

## Evidence and checkout location

Screenshots are kept in ignored `docs/qa/landing-recovery/`: `last-good-{1440,390}.png`, `home-{1440,390}.png`, `hero-{1440,390}.png`, `module-{1440,390}.png`, `shop-{1440,390}.png`, `summer-drop-{1440,390}.png`, `checkout-summary-{1440,390}.png`, and `card-brick-ready.png`. Private QA state is excluded from Git.

macOS offloaded source and Git objects in the Desktop checkout during this task. Work continued in a fresh clone at `/tmp/luzela-landing-recovery`, based on the same production commit. The final changes and evidence are copied back to the requested Desktop workspace. Unrelated untracked user documents are preserved.

Deployment identifiers and the post-deployment smoke outcome are recorded separately in the local `docs/qa/landing-recovery/RELEASE_REPORT.md` after the authorized push and deployment.

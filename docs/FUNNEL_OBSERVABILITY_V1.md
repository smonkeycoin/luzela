# Funnel observability V1

The canonical boundary is `commerce_measurement_settings.FUNNEL_MEASUREMENT_START` in Supabase. Set its `value` to the actual timestamp at which the instrumented production deployment becomes active. Do not backfill the previous blind period. The admin funnel excludes all events before this timestamp and all `is_qa` or non-production events.

## Event ownership

- Browser: session, surface and product views, add to cart, cart view, checkout arrival, payment page ready, Card Brick submit.
- Server: checkout creation, provider result, purchase. The browser endpoint has a strict event allowlist and a separate `client:` event key namespace.
- `purchase:{order_id}` is unique. Only successful `confirm_paid_order` reconciliation can create it. Values are integer cents: gross merchandise, discount, net merchandise, shipping, and collected total. Shipping is not product revenue.
- `anonymous_session_id` is random and stored in browser session storage for 30 minutes of activity. It is not derived from identity or device attributes.
- Attribution is first and last touch; referrer is reduced to a domain in `commerce_events`. Chavolines can be identified by campaign, ref, or coupon. Unknown and direct remain distinct from Instagram.

## Data handling

The table has no customer identity, contact, address, IP, location, or card fields. The public roles have no table privileges; server code writes with the Supabase secret key. The client endpoint accepts only predefined fields, caps payload size, and rate limits per anonymous session. The retention target is **13 months**. Operations should run this monthly after reviewing backup policy:

```sql
delete from public.commerce_events
where occurred_at < now() - interval '13 months';
```

Keep QA events for diagnostics during that period. `funnel_qa=1` on the entry URL marks the browser session for QA; automated browsers are also flagged by user agent and `navigator.webdriver`. QA orders should be cleaned up through the normal order workflow, while QA events remain tagged.

Meta Pixel is separate from first-party analytics. It requires `NEXT_PUBLIC_META_PIXEL_ID` **and** opt-in stored as `luzela_marketing_consent_v1=granted` through the privacy page. No customer fields are sent. Its Purchase event requires a server-confirmed paid order and a per-order browser dedupe key. First-party purchase remains authoritative.

## Operational validation

Before the production boundary: apply the additive migration, run unit tests, lint, build, and a QA-marked flow through Card Brick readiness without entering card data. Simulate an analytics insert failure and verify cart, checkout, payment page, and paid reconciliation paths continue. After deployment: record the exact production activation time, make one normal human visit, and confirm Vercel Web Analytics, Speed Insights, and a first-party `session_started` row. Vercel project switches must be enabled in addition to installing packages.

At 72 hours report early session-to-purchase counts by source; do not infer a commercial cause from a tiny sample. At seven complete instrumented days classify the bottleneck from measured traffic, product interest, cart, checkout, and payment data.

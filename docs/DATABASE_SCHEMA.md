# Database Schema

The canonical schema is in `supabase/schema.sql`.

## Groups

- Admin: `admin_users`, `audit_log`, `app_settings`.
- Customers: `customers`, `customer_addresses`, `customer_notes`.
- Catalog: `products`, `product_variants`, `product_images`.
- Inventory: `inventory`, `inventory_movements`.
- Orders: `orders`, `order_items`, `shipments`.
- Payments: `payments`, `payment_events`, `checkout_sessions`.
- Growth readiness: `coupons`, `coupon_redemptions`, `abandoned_checkouts`, `email_events`, `whatsapp_events`.

## Important Choices

- Money is stored as integer cents in `mxn` by default.
- Products and variants support soft delete with `deleted_at`.
- Inventory is ledger-first. `inventory.stock_on_hand` is a materialized operational field updated from movements in Sprint 1 transactions.
- Payment state and fulfillment state are separate.
- Stripe IDs are unique where idempotency requires it.
- Customer auth is optional; guest checkout is first-class.

## Supabase 2026 Note

Supabase announced that new tables in `public` may no longer be exposed to the Data API without explicit `GRANT` statements. The schema includes explicit grants and RLS policies intentionally.

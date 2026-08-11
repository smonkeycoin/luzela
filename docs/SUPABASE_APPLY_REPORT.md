# Supabase Apply Report

Date: 2026-08-11

## Project

- Project: `luzela-commerce`
- Project ref: `hegljvvrqztbjavwvdzo`
- Region: `us-east-1`
- Database: Postgres 17
- NeumoPractice was not modified.

## Application Result

- `supabase/schema.sql`: applied as migration `initial_luzela_commerce_schema`.
- Grant hardening migration applied: `harden_anon_grants`.
- Public inventory read migration applied: `allow_public_inventory_read`.
- `supabase/seed.sql`: applied.

## Verified Tables

Supabase returned the expected public tables with RLS enabled:

- `admin_users`
- `app_settings`
- `customers`
- `customer_addresses`
- `products`
- `product_variants`
- `product_images`
- `inventory`
- `inventory_movements`
- `orders`
- `order_items`
- `payments`
- `payment_events`
- `shipments`
- `checkout_sessions`
- `abandoned_checkouts`
- `coupons`
- `coupon_redemptions`
- `customer_notes`
- `email_events`
- `whatsapp_events`
- `audit_log`

## Seed Evidence

- `products`: 2
- `product_variants`: 2
- `inventory`: 2
- `inventory_movements`: 2

Seeded SKUs:

- `LUZ-SPF50-IND`: 59000 cents, stock 25
- `LUZ-SPF50-DUO`: 99000 cents, stock 15

## RLS And Grants

- RLS enabled on all public tables.
- Policy counts verified through `pg_policy`.
- `anon` grants were corrected after verification found broad Supabase defaults.
- Final `anon` grants: `SELECT` on 5 tables only.
- `authenticated` and `service_role` grants exist for operational tables.

## Constraints, Indexes, Triggers

- Indexes verified: 70
- Constraints verified: primary key, foreign key, unique and check constraints present.
- `updated_at` triggers verified on 13 mutable tables.

## Remaining Backend Blocker

The Supabase connector exposes publishable/anon keys, but not `SUPABASE_SERVICE_ROLE_KEY`. The local app still needs the Luzela service-role key for server-side checkout creation, webhook processing, admin reads and Resend event persistence.

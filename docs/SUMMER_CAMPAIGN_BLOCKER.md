# Summer Campaign Blocker

The current schema includes `product_variants.bundle_components`, but the
locked checkout/payment fulfillment path does not use it for inventory
consumption.

Current behavior confirmed in `public.confirm_paid_order`:

- It loops over `order_items`.
- It decrements `inventory.stock_on_hand` by `order_items.quantity`.
- It writes `inventory_movements.quantity_delta = -order_items.quantity`.

That means a checkout for 1 pack of `SUMMER 3X` would create one order item with
quantity `1` and would decrement only `1` inventory unit, not `3` physical Luzela
units.

## Required Engine Change

To safely activate the SUMMER campaign, the locked Commerce Engine needs an
explicit, reviewed adaptation so physical units are derived from product data:

- `SUMMER 1X` consumes `1` physical unit per pack.
- `SUMMER 2X` consumes `2` physical units per pack.
- `SUMMER 3X` consumes `3` physical units per pack.

The same physical unit quantity must be used consistently for:

- stock availability checks before Checkout
- checkout order item metadata/admin semantics
- `confirm_paid_order`
- inventory movement idempotency
- duplicate webhook behavior

No Supabase catalog activation was applied because doing so before this engine
change would break physical inventory semantics.


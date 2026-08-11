# Order Engine

## State Machine

Order status:

`draft -> pending_payment -> paid -> preparing -> ready_to_ship -> shipped -> delivered`

Terminal or exceptional states:

`cancelled`, `refunded`

## Rules

- `pending_payment` is created before redirecting to Stripe.
- `paid` is set only from a signed webhook after idempotency checks.
- Fulfillment actions do not imply payment changes.
- Refunds are a secure admin flow and should reconcile Stripe, `payments`, `orders`, `inventory_movements` and `audit_log`.

## Detail View

Admin order detail must show order number, customer, address, products, quantities, subtotal, discounts, shipping, total, payment status, fulfillment status, Stripe IDs, tracking, notes and timeline.

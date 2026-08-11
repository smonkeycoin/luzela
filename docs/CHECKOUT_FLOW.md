# Checkout Flow

## Customer Flow

1. Contact.
2. Shipping address.
3. Server-side order draft.
4. Stripe Checkout Session.
5. Browser redirect to success.
6. Signed Stripe webhook confirms payment.
7. Order moves to `paid`.

## Server Flow

1. Validate payload with Zod.
2. Read product variant and authorized price from Supabase.
3. Check active product, active variant and available inventory.
4. Create or upsert customer.
5. Create order with `pending_payment`.
6. Store checkout session row.
7. Create Stripe Checkout Session without trusting client price.
8. Redirect to Stripe.

## Webhook Flow

1. Verify `stripe-signature` with raw body.
2. Insert `payment_events` by unique Stripe event ID.
3. Ignore duplicates safely.
4. Reconcile Checkout Session / PaymentIntent.
5. Mark payment succeeded or failed.
6. Move order to `paid` only on successful event.
7. Write inventory sale movement after confirmation.
8. Queue transactional email event.

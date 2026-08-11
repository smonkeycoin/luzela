# Payment Provider Migration

## Status

Luzela Shop now selects a payment provider through `PAYMENT_PROVIDER`.

- Active provider target: `mercadopago`
- Rollback provider retained: `stripe`
- Public checkout copy: Mercado Pago
- Stripe public storefront/checkout references: removed from current UI

## Mercado Pago Integration

Integration type: Checkout API via Orders API with Card Payment Brick.

The browser loads MercadoPago.js and renders the Card Payment Brick on `/checkout/payment`.
Luzela never receives raw card number, CVV, or PAN. The browser posts the card token and minimal payment metadata to `/api/mercadopago/order`.

Server-side order creation uses:

- `Authorization: Bearer MERCADOPAGO_ACCESS_TOKEN`
- `X-Idempotency-Key: mp-order:{checkout_session_id}`
- `external_reference = internal order id`
- amount loaded from the internal `payments` row, never from the client

## Webhook

Endpoint:

`/api/mercadopago/webhook`

Webhook processing:

- validates `x-signature`
- validates `x-request-id`
- verifies the authoritative order with Mercado Pago before marking paid
- deduplicates by `(provider, provider_event_id)`
- confirms paid state only through `confirm_paid_order`

## Required Env

Development, Preview, and Production need:

- `PAYMENT_PROVIDER=mercadopago`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_APPLICATION_ID` if required by the selected Mercado Pago application flow

Never expose `MERCADOPAGO_ACCESS_TOKEN` as a `NEXT_PUBLIC_*` variable.

## Remaining E2E Blocker

Real Mercado Pago Test E2E is blocked until valid Mercado Pago test credentials are configured locally, especially `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET`.

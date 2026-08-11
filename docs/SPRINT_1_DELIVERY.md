# Sprint 1 Delivery

## A. Supabase Connected

Yes. Luzela Supabase is connected and used for products, checkout, orders, payments, inventory, email events, and admin reads.

## B. Stripe Test Connected

Yes. Stripe Test keys are configured locally. No Stripe Live key was used.

## C. Webhook Validated

Yes. A fresh Stripe CLI webhook signing secret was generated and loaded into `.env.local`; Next.js was restarted before the valid E2E checkout.

## D. Test Order Created

Yes. Order `LZ-A914643E79` was created from checkout and paid through Stripe Test.

## E. Payment Confirmed By Webhook

Yes. The order changed to `paid` only after signed webhook processing. The success page is informational and did not perform fulfillment.

## F. Inventory Decremented Once

Yes. Stock for `LUZ-SPF50-IND` moved from 25 to 24 and exactly one `sale` movement exists for the paid order.

## G. Duplicate Webhook Safe

Yes. Replaying the same signed event returned 200 but did not create a duplicate event row, duplicate sale movement, or second stock decrement.

## H. Admin Shows Order

Yes. The owner-authenticated admin orders page shows the paid order, and the detail page shows customer, address, item, total, Stripe IDs, payment row count, inventory movement, and timeline.

## I. Failure Cases

- Payment failure: pass.
- Refresh success page: pass.
- Duplicate webhook: pass.
- Stock insufficient: pass.
- Refund: not executed; refund state update exists for `charge.refunded`, inventory return is not part of Sprint 1.

## J. Email

Skipped. `RESEND_API_KEY` is empty, checkout still completes, and `email_events.status = skipped` is persisted after payment confirmation.

## K. Bugs Found

- Catalog stock was displayed as zero because Supabase returned `inventory` as an object rather than an array in the nested relationship.
- Payment failed webhook events initially persisted but did not attach to the order because the PaymentIntent lacked order metadata.
- A non-persistent shell-launched Stripe listener missed events; the final pass used a persistent `stripe listen` session.

## L. Validation

```txt
npm run test: pass
npm run lint: pass
npm run build: pass
npx playwright test: pass
```

## M. Ready For Sprint 2

Yes.

## Sprint 2.1 Pack Inventory Addendum

Sprint 2.1 implemented the approved narrow Commerce Engine change for SUMMER pack variants backed by one physical Luzela inventory pool.

Validation:

```txt
1X sale movement: -1
2X sale movement: -2
3X sale movement: -3
2 x 3X sale movement: -6
Duplicate signed webhook: safe
Stock insufficient: pass
```

Full report: `docs/SPRINT_2_1_PACK_INVENTORY_REPORT.md`

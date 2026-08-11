# Inventory Engine

Inventory works through movements, not direct stock edits.

## Movement Types

- `purchase`
- `sale`
- `adjustment`
- `return`
- `damage`
- `manual_correction`

## Rules

- Stock is never sold from client-side availability.
- Checkout creation must run a server-side availability check.
- A sale movement is created only when payment is confirmed.
- Reservations can be added in Sprint 1 if payment windows create oversell risk.
- Every manual correction requires an audit entry and operator identity.

## Current Stock

Sprint 0 defines `inventory` for fast dashboard reads and `inventory_movements` as the source ledger. Sprint 1 should update both in a single transaction or use a database function.

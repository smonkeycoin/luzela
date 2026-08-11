# Admin Spec

Route: `/admin`

Auth: Supabase Auth plus `admin_users`.

## Dashboard Metrics

- Ventas hoy.
- Ventas semana.
- Ventas mes.
- Ordenes.
- Ticket promedio.
- Unidades vendidas.
- Stock.
- Stock bajo.
- Clientes.
- Clientes recurrentes.
- Carritos abandonados.

## Modules

- Dashboard.
- Orders.
- Products.
- Inventory.
- Customers.
- Coupons.
- Shipping.
- Analytics.
- Settings.

## Mutation Policy

Important admin mutations must write `audit_log` with actor, action, table, row ID, before and after payloads where appropriate.

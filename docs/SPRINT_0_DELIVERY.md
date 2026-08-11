# Sprint 0 Delivery

## A. Arquitectura Propuesta

Next.js App Router para storefront, checkout y admin. Supabase Postgres/Auth mantiene la verdad operativa. Stripe Checkout cobra server-side. Un webhook firmado reconcilia pagos. Resend queda preparado para emails transaccionales.

## B. Arbol de Archivos

```txt
src/app
  page.tsx
  checkout/page.tsx
  checkout/success/page.tsx
  admin/*
  api/checkout/route.ts
  api/stripe/webhook/route.ts
src/lib
  checkout/*
  email/*
  inventory/*
  orders/*
  stripe/*
  supabase/*
docs/*
supabase/schema.sql
supabase/seed.sql
.env.example
```

## C. Schema Supabase

Ver `supabase/schema.sql`. Incluye admins, customers, catalogo, inventario, ordenes, pagos, shipments, cupones, abandoned checkout, eventos, audit log y settings.

## D. Flujo Checkout

Cliente captura contacto y direccion. Servidor valida, consulta precio autorizado, crea orden `pending_payment`, crea Stripe Checkout y redirige.

## E. Flujo Webhook

Stripe envia evento firmado. El servidor verifica firma, guarda evento por ID unico, reconcilia PaymentIntent/CheckoutSession y solo entonces marca la orden como `paid`.

## F. Flujo Inventory

Inventario se registra con `inventory_movements`. El dashboard lee `inventory.stock_on_hand` como campo operacional, pero el ledger es la fuente auditable.

## G. Admin Modules

Dashboard, Orders, Products, Inventory, Customers, Coupons, Shipping, Analytics y Settings.

## H. Riesgos

- Oversell si Sprint 1 no implementa transaccion atomica para disponibilidad.
- Webhook duplicado si no se respeta `payment_events.stripe_event_id`.
- RLS roto si se crean tablas nuevas sin grants/policies.
- Stripe Tax no debe activarse sin validar registros fiscales.
- Emails/WhatsApp pueden convertirse en spam si se automatizan antes de tener consentimientos y limites.

## I. Sprint 1 Necesita

- Crear proyecto Supabase y aplicar schema.
- Configurar Auth/admin invite.
- Conectar lectura de catalogo real.
- Implementar checkout server-side completo.
- Implementar webhook idempotente completo.
- Implementar transaccion de inventario.
- Crear CRUD Products y Orders.
- Configurar Resend sandbox.
- Agregar pruebas de state machines y webhook.

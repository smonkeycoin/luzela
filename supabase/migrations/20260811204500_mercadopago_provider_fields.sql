alter table public.orders
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists provider_order_id text unique,
  add column if not exists provider_payment_id text unique;

alter table public.payments
  add column if not exists provider_order_id text unique,
  add column if not exists provider_payment_id text unique;

alter table public.checkout_sessions
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_order_id text unique,
  add column if not exists provider_checkout_url text,
  add column if not exists provider_payment_id text unique;

alter table public.payment_events
  add column if not exists provider_event_id text;

alter table public.payment_events
  alter column stripe_event_id drop not null;

create unique index if not exists payment_events_provider_event_uidx
  on public.payment_events(provider, provider_event_id)
  where provider_event_id is not null;

alter table public.payment_events
  drop constraint if exists payment_events_provider_event_or_stripe;

alter table public.payment_events
  add constraint payment_events_provider_event_or_stripe
  check (stripe_event_id is not null or provider_event_id is not null);

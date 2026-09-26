-- Server-owned, PII-free commerce telemetry. Monetary amounts are integer MXN cents.
create table public.commerce_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'session_started','view_home','view_shop','view_campaign','view_product',
    'add_to_cart','view_cart','begin_checkout','checkout_created',
    'payment_page_viewed','payment_submitted','payment_provider_accepted',
    'payment_provider_rejected','purchase')),
  event_key text unique,
  occurred_at timestamptz not null default now(),
  anonymous_session_id uuid,
  order_id uuid references public.orders(id) on delete set null,
  checkout_session_id uuid references public.checkout_sessions(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_sku text,
  quantity integer check (quantity is null or quantity > 0),
  value_cents integer check (value_cents is null or value_cents >= 0),
  currency text not null default 'mxn',
  first_source text,
  first_medium text,
  first_campaign text,
  first_content text,
  first_ref text,
  source text,
  medium text,
  campaign text,
  content text,
  ref text,
  referrer_domain text,
  landing_path text,
  is_qa boolean not null default false,
  environment text not null check (environment in ('production','preview','development')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commerce_events_metadata_size check (octet_length(metadata::text) <= 2048),
  constraint commerce_events_source_length check (length(source) <= 160 and length(campaign) <= 160),
  constraint commerce_events_path_length check (length(landing_path) <= 256)
);

create index commerce_events_date_idx on public.commerce_events (occurred_at desc, event_name) where is_qa = false;
create index commerce_events_session_idx on public.commerce_events (anonymous_session_id, occurred_at);
create index commerce_events_order_idx on public.commerce_events (order_id) where order_id is not null;
create index commerce_events_checkout_idx on public.commerce_events (checkout_session_id) where checkout_session_id is not null;
create index commerce_events_product_idx on public.commerce_events (product_id) where product_id is not null;
alter table public.commerce_events enable row level security;
revoke all on public.commerce_events from anon, authenticated;
grant select, insert on public.commerce_events to service_role;

create table public.commerce_measurement_settings (
  key text primary key check (key = 'FUNNEL_MEASUREMENT_START'),
  value timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.commerce_measurement_settings (key) values ('FUNNEL_MEASUREMENT_START');
alter table public.commerce_measurement_settings enable row level security;
revoke all on public.commerce_measurement_settings from anon, authenticated;
grant select, update on public.commerce_measurement_settings to service_role;

-- Retention is executed by operations after 13 months, not an unbounded log.
-- delete from public.commerce_events where occurred_at < now() - interval '13 months';

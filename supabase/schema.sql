create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.product_status as enum ('draft', 'active', 'inactive', 'archived');
create type public.order_status as enum (
  'draft',
  'pending_payment',
  'paid',
  'preparing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);
create type public.payment_status as enum ('not_started', 'requires_payment', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.fulfillment_status as enum ('unfulfilled', 'preparing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled');
create type public.inventory_movement_type as enum ('purchase', 'sale', 'adjustment', 'return', 'damage', 'manual_correction');
create type public.checkout_status as enum ('started', 'contact_captured', 'payment_started', 'converted', 'abandoned', 'expired');
create type public.shipment_status as enum ('pending', 'ready', 'shipped', 'delivered', 'returned', 'lost');
create type public.coupon_status as enum ('draft', 'active', 'inactive', 'expired');
create type public.message_status as enum ('queued', 'sent', 'delivered', 'failed', 'skipped');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext not null unique,
  role text not null default 'readonly' check (role in ('owner', 'admin', 'operations', 'readonly')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  public_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email citext not null,
  phone text,
  first_name text,
  last_name text,
  marketing_email_consent boolean not null default false,
  marketing_sms_consent boolean not null default false,
  last_order_at timestamptz,
  lifetime_value_cents integer not null default 0 check (lifetime_value_cents >= 0),
  units_purchased integer not null default 0 check (units_purchased >= 0),
  replenishment_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (email)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  full_name text,
  phone text,
  line1 text not null,
  line2 text,
  neighborhood text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'MX',
  is_default_shipping boolean not null default false,
  is_default_billing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status public.product_status not null default 'draft',
  is_bundle boolean not null default false,
  free_shipping boolean not null default false,
  sort_order integer not null default 0,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  status public.product_status not null default 'draft',
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= price_cents),
  currency text not null default 'mxn',
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  bundle_components jsonb not null default '[]'::jsonb,
  stripe_price_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  status public.coupon_status not null default 'draft',
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed_amount', 'free_shipping')),
  percent_off numeric(5, 2) check (percent_off is null or (percent_off > 0 and percent_off <= 100)),
  amount_off_cents integer check (amount_off_cents is null or amount_off_cents > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('LZ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  customer_id uuid references public.customers(id) on delete set null,
  shipping_address_id uuid references public.customer_addresses(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  status public.order_status not null default 'draft',
  payment_status public.payment_status not null default 'not_started',
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  currency text not null default 'mxn',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  payment_provider text not null default 'stripe',
  provider_order_id text unique,
  provider_payment_id text unique,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  internal_notes text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  inventory_variant_id uuid references public.product_variants(id) on delete set null,
  sku text not null,
  name text not null,
  quantity integer not null check (quantity > 0),
  units_per_pack integer not null default 1 check (units_per_pack > 0),
  physical_units integer not null default 1 check (physical_units > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'stripe',
  status public.payment_status not null default 'requires_payment',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'mxn',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text unique,
  provider_order_id text unique,
  provider_payment_id text unique,
  idempotency_key text unique,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  stripe_event_id text unique,
  provider_event_id text,
  event_type text not null,
  payment_id uuid references public.payments(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payment_events
  add constraint payment_events_provider_event_or_stripe
  check (stripe_event_id is not null or provider_event_id is not null);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.shipment_status not null default 'pending',
  carrier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  status public.checkout_status not null default 'started',
  email citext,
  phone text,
  provider text not null default 'stripe',
  provider_order_id text unique,
  provider_checkout_url text,
  provider_payment_id text unique,
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text unique,
  abandoned_checkout_id uuid,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.abandoned_checkouts (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid references public.checkout_sessions(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  status public.checkout_status not null default 'started',
  email citext,
  phone text,
  last_step text,
  cart_snapshot jsonb not null default '{}'::jsonb,
  converted_order_id uuid references public.orders(id) on delete set null,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkout_sessions
  add constraint checkout_sessions_abandoned_checkout_id_fkey
  foreign key (abandoned_checkout_id) references public.abandoned_checkouts(id) on delete set null;

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete cascade,
  discount_cents integer not null default 0 check (discount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  movement_type public.inventory_movement_type not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  template_key text not null,
  status public.message_status not null default 'queued',
  provider_message_id text unique,
  idempotency_key text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  event_key text not null,
  status public.message_status not null default 'queued',
  provider_message_id text unique,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  row_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index admin_users_user_id_idx on public.admin_users(user_id) where active;
create index customers_email_idx on public.customers(email) where deleted_at is null;
create index customers_phone_idx on public.customers(phone) where phone is not null;
create index customer_addresses_customer_id_idx on public.customer_addresses(customer_id) where deleted_at is null;
create index products_status_sort_idx on public.products(status, sort_order) where deleted_at is null;
create index product_variants_product_id_idx on public.product_variants(product_id) where deleted_at is null;
create index product_images_product_sort_idx on public.product_images(product_id, sort_order);
create unique index product_images_product_url_unique_idx on public.product_images(product_id, url);
create index inventory_variant_id_idx on public.inventory(variant_id);
create index order_items_inventory_variant_id_idx on public.order_items(inventory_variant_id) where inventory_variant_id is not null;
create index inventory_movements_variant_created_idx on public.inventory_movements(variant_id, created_at desc);
create index inventory_movements_order_id_idx on public.inventory_movements(order_id) where order_id is not null;
create index orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index orders_status_idx on public.orders(status);
create index orders_paid_at_idx on public.orders(paid_at) where paid_at is not null;
create index order_items_order_id_idx on public.order_items(order_id);
create index payments_order_id_idx on public.payments(order_id);
create index payment_events_order_id_idx on public.payment_events(order_id) where order_id is not null;
create unique index payment_events_provider_event_uidx
  on public.payment_events(provider, provider_event_id)
  where provider_event_id is not null;
create index shipments_order_id_idx on public.shipments(order_id);
create unique index shipments_order_id_unique_idx on public.shipments(order_id);
create index shipments_tracking_number_idx on public.shipments(tracking_number) where tracking_number is not null;
create index coupons_status_idx on public.coupons(status);
create index checkout_sessions_status_created_idx on public.checkout_sessions(status, created_at desc);
create index abandoned_checkouts_status_created_idx on public.abandoned_checkouts(status, created_at desc);
create index customer_notes_customer_created_idx on public.customer_notes(customer_id, created_at desc);
create index email_events_status_created_idx on public.email_events(status, created_at desc);
create unique index email_events_idempotency_key_unique_idx on public.email_events(idempotency_key) where idempotency_key is not null;
create index whatsapp_events_status_created_idx on public.whatsapp_events(status, created_at desc);
create index audit_log_table_row_idx on public.audit_log(table_name, row_id);

create trigger admin_users_updated_at before update on public.admin_users for each row execute function public.set_updated_at();
create trigger app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger customer_addresses_updated_at before update on public.customer_addresses for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();
create trigger checkout_sessions_updated_at before update on public.checkout_sessions for each row execute function public.set_updated_at();
create trigger abandoned_checkouts_updated_at before update on public.abandoned_checkouts for each row execute function public.set_updated_at();
create trigger inventory_updated_at before update on public.inventory for each row execute function public.set_updated_at();

create or replace function public.mark_order_shipped(
  p_order_id uuid,
  p_tracking_number text,
  p_tracking_url text,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_order public.orders%rowtype;
  existing_shipment_id uuid;
  created_shipment_id uuid;
  now_value timestamptz := now();
begin
  if nullif(trim(p_tracking_number), '') is null then
    raise exception 'tracking_number_required';
  end if;

  select *
  into locked_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found:%', p_order_id;
  end if;

  if locked_order.payment_status <> 'paid' then
    raise exception 'order_not_paid:%', p_order_id;
  end if;

  if locked_order.status in ('cancelled', 'refunded')
    or locked_order.payment_status in ('refunded')
    or locked_order.fulfillment_status in ('cancelled', 'shipped', 'delivered') then
    raise exception 'shipment_transition_not_allowed:%', p_order_id;
  end if;

  select id
  into existing_shipment_id
  from public.shipments
  where order_id = p_order_id
  limit 1;

  if existing_shipment_id is not null then
    raise exception 'shipment_already_exists:%', existing_shipment_id;
  end if;

  insert into public.shipments (
    order_id,
    status,
    carrier,
    tracking_number,
    tracking_url,
    shipped_at
  )
  values (
    p_order_id,
    'shipped',
    'DHL',
    trim(p_tracking_number),
    p_tracking_url,
    now_value
  )
  returning id into created_shipment_id;

  update public.orders
  set status = 'shipped',
      fulfillment_status = 'shipped',
      shipped_at = now_value
  where id = p_order_id;

  insert into public.audit_log (
    actor_user_id,
    action,
    table_name,
    row_id,
    after_data
  )
  values
    (
      p_actor_user_id,
      'shipment_created',
      'shipments',
      created_shipment_id,
      jsonb_build_object(
        'order_id', p_order_id,
        'carrier', 'DHL',
        'tracking_number', trim(p_tracking_number),
        'tracking_url', p_tracking_url
      )
    ),
    (
      p_actor_user_id,
      'order_marked_shipped',
      'orders',
      p_order_id,
      jsonb_build_object(
        'shipment_id', created_shipment_id,
        'fulfillment_status', 'shipped',
        'shipped_at', now_value
      )
    );

  return created_shipment_id;
end;
$$;

revoke all on function public.mark_order_shipped(uuid, text, text, uuid) from public;
revoke all on function public.mark_order_shipped(uuid, text, text, uuid) from anon;
revoke all on function public.mark_order_shipped(uuid, text, text, uuid) from authenticated;
grant execute on function public.mark_order_shipped(uuid, text, text, uuid) to service_role;

create or replace function public.confirm_paid_order(
  p_order_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_order public.orders%rowtype;
  item record;
begin
  select *
  into locked_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found:%', p_order_id;
  end if;

  if locked_order.payment_status = 'paid' then
    return;
  end if;

  for item in
    select
      id,
      variant_id as commercial_variant_id,
      coalesce(inventory_variant_id, variant_id) as inventory_variant_id,
      quantity as pack_quantity,
      coalesce(units_per_pack, 1) as units_per_pack,
      coalesce(physical_units, quantity * coalesce(units_per_pack, 1)) as physical_units
    from public.order_items
    where order_id = p_order_id
      and coalesce(inventory_variant_id, variant_id) is not null
  loop
    update public.inventory
    set stock_on_hand = stock_on_hand - item.physical_units,
        updated_at = now()
    where variant_id = item.inventory_variant_id
      and stock_on_hand >= item.physical_units;

    if not found then
      raise exception 'insufficient_stock:%', item.inventory_variant_id;
    end if;

    insert into public.inventory_movements (
      variant_id,
      order_id,
      movement_type,
      quantity_delta,
      reason,
      idempotency_key,
      metadata
    )
    values (
      item.inventory_variant_id,
      p_order_id,
      'sale',
      -item.physical_units,
      'Stripe payment confirmed',
      'sale:' || p_order_id::text || ':' || item.id::text,
      jsonb_build_object(
        'order_item_id', item.id,
        'commercial_variant_id', item.commercial_variant_id,
        'pack_quantity', item.pack_quantity,
        'units_per_pack', item.units_per_pack,
        'physical_units', item.physical_units
      )
    )
    on conflict (idempotency_key) do nothing;
  end loop;

  update public.orders
  set status = 'paid',
      payment_status = 'paid',
      paid_at = coalesce(paid_at, now()),
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id)
  where id = p_order_id;

  update public.payments
  set status = 'paid',
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id)
  where order_id = p_order_id;

  update public.checkout_sessions
  set status = 'converted',
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id)
  where order_id = p_order_id;
end;
$$;

revoke all on function public.confirm_paid_order(uuid, text, text) from public;
revoke all on function public.confirm_paid_order(uuid, text, text) from anon;
revoke all on function public.confirm_paid_order(uuid, text, text) from authenticated;
grant execute on function public.confirm_paid_order(uuid, text, text) to service_role;

alter table public.admin_users enable row level security;
alter table public.app_settings enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.shipments enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.abandoned_checkouts enable row level security;
alter table public.customer_notes enable row level security;
alter table public.email_events enable row level security;
alter table public.whatsapp_events enable row level security;
alter table public.audit_log enable row level security;

grant usage on schema public to anon, authenticated, service_role;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
grant usage on schema public to anon;
grant select on public.products, public.product_variants, public.product_images, public.inventory, public.app_settings to anon;
grant select on public.products, public.product_variants, public.product_images, public.app_settings to authenticated;

grant select, insert, update, delete on
  public.admin_users,
  public.app_settings,
  public.customers,
  public.customer_addresses,
  public.products,
  public.product_variants,
  public.product_images,
  public.inventory,
  public.inventory_movements,
  public.orders,
  public.order_items,
  public.payments,
  public.payment_events,
  public.shipments,
  public.coupons,
  public.coupon_redemptions,
  public.checkout_sessions,
  public.abandoned_checkouts,
  public.customer_notes,
  public.email_events,
  public.whatsapp_events,
  public.audit_log
to authenticated, service_role;

create policy "admin users can read own profile"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "public can read active products"
on public.products
for select
to anon, authenticated
using (status = 'active' and deleted_at is null);

create policy "public can read active variants"
on public.product_variants
for select
to anon, authenticated
using (
  status = 'active'
  and deleted_at is null
  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'active'
      and p.deleted_at is null
  )
);

create policy "public can read product images"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'active'
      and p.deleted_at is null
  )
);

create policy "public can read active variant inventory"
on public.inventory
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = variant_id
      and v.status = 'active'
      and v.deleted_at is null
      and p.status = 'active'
      and p.deleted_at is null
  )
);

create policy "public can read public settings"
on public.app_settings
for select
to anon, authenticated
using (public_read = true);

do $$
declare
  table_name text;
  admin_check text := 'exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()) and au.active = true)';
begin
  foreach table_name in array array[
    'app_settings',
    'customers',
    'customer_addresses',
    'products',
    'product_variants',
    'product_images',
    'inventory',
    'inventory_movements',
    'orders',
    'order_items',
    'payments',
    'payment_events',
    'shipments',
    'coupons',
    'coupon_redemptions',
    'checkout_sessions',
    'abandoned_checkouts',
    'customer_notes',
    'email_events',
    'whatsapp_events',
    'audit_log'
  ]
  loop
    execute format('create policy "admins can select" on public.%I for select to authenticated using (%s)', table_name, admin_check);
    execute format('create policy "admins can insert" on public.%I for insert to authenticated with check (%s)', table_name, admin_check);
    execute format('create policy "admins can update" on public.%I for update to authenticated using (%s) with check (%s)', table_name, admin_check, admin_check);
    execute format('create policy "admins can delete" on public.%I for delete to authenticated using (%s)', table_name, admin_check);
  end loop;
end;
$$;

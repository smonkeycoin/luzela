-- Sprint 2.1: commercial pack quantity != physical inventory quantity.
-- Uses product_variants.bundle_components for the single physical Luzela pool.

alter table public.order_items
  add column if not exists inventory_variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists units_per_pack integer not null default 1 check (units_per_pack > 0),
  add column if not exists physical_units integer not null default 1 check (physical_units > 0),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.inventory_movements
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.order_items
set inventory_variant_id = coalesce(inventory_variant_id, variant_id),
    units_per_pack = coalesce(units_per_pack, 1),
    physical_units = greatest(1, quantity * coalesce(units_per_pack, 1)),
    metadata = coalesce(metadata, '{}'::jsonb)
where inventory_variant_id is null
   or units_per_pack is null
   or physical_units is null
   or metadata is null;

create index if not exists order_items_inventory_variant_id_idx
on public.order_items(inventory_variant_id)
where inventory_variant_id is not null;

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

-- Keep historical catalog rows, but remove the old offer from public storefront.
update public.products
set status = 'archived',
    updated_at = now()
where slug in ('luzela-spf-50', 'luzela-duo');

update public.product_variants
set status = 'archived',
    updated_at = now()
where sku in ('LUZ-SPF50-IND', 'LUZ-SPF50-DUO');

insert into public.products (slug, name, description, status, is_bundle, free_shipping, sort_order, attributes)
values
  ('summer-1x', 'SUMMER 1X', 'La esencial. Una Luzela para acompañar tus días de sol.', 'active', true, true, 10, '{"campaign":"summer","units_per_pack":1}'::jsonb),
  ('summer-2x', 'SUMMER 2X', 'Una para ti. Una para compartir.', 'active', true, true, 20, '{"campaign":"summer","units_per_pack":2,"unit_price_display":"$325 c/u"}'::jsonb),
  ('summer-3x', 'SUMMER 3X', 'Una para ti. Una para compartir. Una para que no falte.', 'active', true, true, 30, '{"campaign":"summer","units_per_pack":3,"unit_price_display":"$297 c/u","badge":"MEJOR VALOR","secondary_headline":"Más días para recordar."}'::jsonb)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    status = 'active',
    is_bundle = excluded.is_bundle,
    free_shipping = excluded.free_shipping,
    sort_order = excluded.sort_order,
    attributes = excluded.attributes,
    deleted_at = null,
    updated_at = now();

insert into public.product_variants (
  product_id,
  sku,
  name,
  status,
  price_cents,
  compare_at_price_cents,
  currency,
  bundle_components,
  metadata
)
select
  p.id,
  values_table.sku,
  values_table.name,
  'active'::public.product_status,
  values_table.price_cents,
  null,
  'mxn',
  jsonb_build_array(
    jsonb_build_object(
      'variant_id', base_variant.id,
      'sku', base_variant.sku,
      'quantity', values_table.units_per_pack
    )
  ),
  jsonb_build_object(
    'campaign', 'summer',
    'analytics_item_id', values_table.analytics_item_id,
    'units_per_pack', values_table.units_per_pack,
    'physical_sku', base_variant.sku
  )
from (
  values
    ('summer-1x', 'LUZ-SUMMER-1X', '1 Luzela', 39000, 1, 'summer_1x'),
    ('summer-2x', 'LUZ-SUMMER-2X', '2 Luzelas', 65000, 2, 'summer_2x'),
    ('summer-3x', 'LUZ-SUMMER-3X', '3 Luzelas', 89000, 3, 'summer_3x')
) as values_table(product_slug, sku, name, price_cents, units_per_pack, analytics_item_id)
join public.products p on p.slug = values_table.product_slug
join public.product_variants base_variant on base_variant.sku = 'LUZ-SPF50-IND'
on conflict (sku) do update
set product_id = excluded.product_id,
    name = excluded.name,
    status = 'active',
    price_cents = excluded.price_cents,
    compare_at_price_cents = excluded.compare_at_price_cents,
    currency = excluded.currency,
    bundle_components = excluded.bundle_components,
    metadata = excluded.metadata,
    deleted_at = null,
    updated_at = now();

update public.product_images i
set alt_text = p.name,
    sort_order = 10
from public.products p
where i.product_id = p.id
  and i.url = '/luzela/bottle.webp'
  and p.slug in ('summer-1x', 'summer-2x', 'summer-3x');

insert into public.product_images (product_id, url, alt_text, sort_order)
select p.id, '/luzela/bottle.webp', p.name, 10
from public.products p
where p.slug in ('summer-1x', 'summer-2x', 'summer-3x')
  and not exists (
    select 1
    from public.product_images i
    where i.product_id = p.id
      and i.url = '/luzela/bottle.webp'
  );

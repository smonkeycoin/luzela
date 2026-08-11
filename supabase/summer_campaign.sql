-- Re-runnable SUMMER campaign activation script.
-- Requires pack inventory engine migration first.

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

do $$
begin
  if not exists (
    select 1
    from product_variants
    where sku = 'LUZ-SPF50-IND'
  ) then
    raise exception 'Missing base Luzela inventory variant LUZ-SPF50-IND';
  end if;
end $$;

with base_variant as (
  select id
  from product_variants
  where sku = 'LUZ-SPF50-IND'
  limit 1
),
product_row as (
  insert into products (
    slug,
    name,
    description,
    status,
    is_visible,
    is_bundle,
    free_shipping,
    sort_order,
    attributes
  )
  values (
    'luzela-pack-10',
    'LUZELA · Pack 10',
    'Pack mayorista de 10 piezas Luzela con precio preferencial y envío incluido.',
    'active',
    true,
    true,
    true,
    40,
    jsonb_build_object(
      'category', 'Compra por volumen',
      'badge', '10 PIEZAS',
      'secondary_headline', '10 piezas · $222 por unidad',
      'unit_price_display', '$222 c/u',
      'campaign', 'wholesale'
    )
  )
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    status = 'active',
    is_visible = true,
    is_bundle = true,
    free_shipping = true,
    sort_order = excluded.sort_order,
    attributes = coalesce(products.attributes, '{}'::jsonb) || excluded.attributes,
    updated_at = now()
  returning id
)
insert into product_variants (
  product_id,
  sku,
  name,
  status,
  price_cents,
  compare_at_price_cents,
  offer_price_cents,
  offer_active,
  currency,
  bundle_components,
  metadata
)
select
  product_row.id,
  'LUZ-PACK-10',
  '10 piezas',
  'active',
  222000,
  null,
  null,
  false,
  'mxn',
  jsonb_build_array(
    jsonb_build_object(
      'sku', 'LUZ-SPF50-IND',
      'variant_id', base_variant.id,
      'quantity', 10
    )
  ),
  jsonb_build_object(
    'analytics_item_id', 'luzela_pack_10',
    'campaign', 'wholesale',
    'physical_sku', 'LUZ-SPF50-IND',
    'units_per_pack', 10,
    'shipping_mode', 'included'
  )
from product_row
cross join base_variant
on conflict (sku) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  status = 'active',
  price_cents = excluded.price_cents,
  compare_at_price_cents = null,
  offer_price_cents = null,
  offer_active = false,
  currency = excluded.currency,
  bundle_components = excluded.bundle_components,
  metadata = coalesce(product_variants.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into product_images (
  product_id,
  url,
  alt_text,
  sort_order
)
select
  products.id,
  '/luzela/bottle.webp',
  'Luzela SPF 50+',
  10
from products
where products.slug = 'luzela-pack-10'
  and not exists (
    select 1
    from product_images
    where product_images.product_id = products.id
      and product_images.url = '/luzela/bottle.webp'
  );

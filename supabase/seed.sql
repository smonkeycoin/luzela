insert into public.app_settings (key, value, public_read)
values
  ('store_name', '"Luzela"'::jsonb, true),
  ('default_country', '"México"'::jsonb, true),
  ('timezone', '"America/Mexico_City"'::jsonb, true),
  ('locale', '"es-MX"'::jsonb, true),
  ('currency_code', '"MXN"'::jsonb, true),
  ('low_stock_threshold', '20'::jsonb, false),
  ('critical_stock_threshold', '10'::jsonb, false),
  ('show_exact_stock_publicly', 'false'::jsonb, true),
  ('default_carrier', '"DHL"'::jsonb, false),
  ('carrier_display_name', '"DHL Express"'::jsonb, true),
  ('shipping_min_days', '2'::jsonb, true),
  ('shipping_max_days', '5'::jsonb, true),
  ('shipping_business_days', 'true'::jsonb, true),
  ('free_shipping_enabled', 'true'::jsonb, true),
  ('shipping_fee_cents', '0'::jsonb, true),
  (
    'shipping_policy_short',
    '"Envío incluido a todo México. Entrega estimada de 2 a 5 días hábiles mediante DHL Express."'::jsonb,
    true
  ),
  ('transactional_emails_enabled', 'true'::jsonb, false),
  ('order_confirmation_email_enabled', 'true'::jsonb, false),
  ('shipping_confirmation_email_enabled', 'true'::jsonb, false),
  ('resend_from_name', '"Luzela"'::jsonb, false),
  ('resend_from_email', '"orders@luzela.mx"'::jsonb, false),
  ('reply_to_email', '""'::jsonb, false),
  ('customer_notes_enabled', 'true'::jsonb, false),
  ('analytics_enabled', 'true'::jsonb, false),
  ('public_reviews_enabled', 'true'::jsonb, true)
on conflict (key) do update
set value = excluded.value,
    public_read = excluded.public_read;

insert into public.products (slug, name, description, status, sort_order)
values
  ('luzela-spf-50', 'Luzela SPF 50+', 'Protector solar Luzela SPF 50+.', 'archived', 10),
  ('luzela-duo', 'Luzela Duo', 'Bundle Luzela con precio especial y envio incluido.', 'archived', 20)
on conflict (slug) do nothing;

update public.products
set status = 'archived',
    free_shipping = false,
    deleted_at = null
where slug = 'luzela-spf-50';

update public.products
set status = 'archived',
    free_shipping = true,
    is_bundle = true,
    deleted_at = null
where slug = 'luzela-duo';

insert into public.product_variants (product_id, sku, name, status, price_cents, compare_at_price_cents, currency)
select id, 'LUZ-SPF50-IND', 'Individual', 'archived', 59000, null, 'mxn'
from public.products
where slug = 'luzela-spf-50'
on conflict (sku) do update
set status = 'archived',
    price_cents = excluded.price_cents,
    compare_at_price_cents = excluded.compare_at_price_cents,
    deleted_at = null;

insert into public.product_variants (product_id, sku, name, status, price_cents, compare_at_price_cents, currency)
select id, 'LUZ-SPF50-DUO', 'Duo', 'archived', 99000, 118000, 'mxn'
from public.products
where slug = 'luzela-duo'
on conflict (sku) do update
set status = 'archived',
    price_cents = excluded.price_cents,
    compare_at_price_cents = excluded.compare_at_price_cents,
    deleted_at = null;

insert into public.inventory (variant_id, stock_on_hand, low_stock_threshold)
select id, 25, 5
from public.product_variants
where sku = 'LUZ-SPF50-IND'
on conflict (variant_id) do update
set low_stock_threshold = excluded.low_stock_threshold;

insert into public.inventory_movements (variant_id, movement_type, quantity_delta, reason, idempotency_key)
select id, 'purchase', 25, 'Seed opening physical bottle stock', 'seed-opening-stock-LUZ-SPF50-IND'
from public.product_variants
where sku = 'LUZ-SPF50-IND'
on conflict (idempotency_key) do nothing;

insert into public.product_images (product_id, url, alt_text, sort_order)
select id, '/luzela/bottle.webp', 'Luzela SPF 50+', 10
from public.products
where slug = 'luzela-spf-50'
  and not exists (
    select 1 from public.product_images i
    where i.product_id = public.products.id
      and i.url = '/luzela/bottle.webp'
  );

\ir ./summer_campaign.sql

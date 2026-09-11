alter table public.products
  add column if not exists is_visible boolean not null default true;

create index if not exists products_visible_status_sort_idx
on public.products(is_visible, status, sort_order)
where deleted_at is null;

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
on public.products
for select
to anon, authenticated
using (status = 'active' and is_visible = true and deleted_at is null);

drop policy if exists "public can read active variants" on public.product_variants;
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
      and p.is_visible = true
      and p.deleted_at is null
  )
);

drop policy if exists "public can read product images" on public.product_images;
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
      and p.is_visible = true
      and p.deleted_at is null
  )
);

drop policy if exists "public can read active variant inventory" on public.inventory;
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
      and p.is_visible = true
      and p.deleted_at is null
  )
);

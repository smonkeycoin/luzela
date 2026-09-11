-- Authorized production price sync. Targets verified against the live catalog.
-- Public-source edition resolves the existing private code from its sole collaborator coupon.
-- The executed production migration contained the equivalent verified private value.
-- Canonical public prices in MXN cents. Existing order/payment snapshots remain unchanged.
begin;
do $$ begin
 if (select count(*) from public.product_variants v join public.products p on p.id=v.product_id
     where (p.slug,v.sku) in (('summer-1x','LUZ-SUMMER-1X'),('summer-2x','LUZ-SUMMER-2X'),('summer-3x','LUZ-SUMMER-3X'))
     and v.status='active' and v.deleted_at is null and p.status='active' and p.deleted_at is null)<>3 then
  raise exception 'Expected exactly three active SUMMER variants; review catalog before pricing migration';
 end if;
 if (select count(*) from public.coupons where collaborator_id=(select id from public.collaborators where slug='chavolines'))<>1
 or (select count(*) from public.collaborators where slug='chavolines')<>1 then
  raise exception 'Existing collaboration V1 is required';
 end if;
end $$;
do $$ declare affected integer; begin
update public.product_variants v
set price_cents=prices.cents, offer_price_cents=null, offer_active=false,
    compare_at_price_cents=null, updated_at=now()
from (values ('LUZ-SUMMER-1X',45900),('LUZ-SUMMER-2X',76900),('LUZ-SUMMER-3X',81900)) prices(sku,cents)
where v.sku=prices.sku;
get diagnostics affected=row_count;
if affected<>3 then raise exception 'Expected 3 variant updates, got %',affected; end if;
-- Remove stale display-only money; application derives labels from canonical prices.
update public.products set attributes=attributes-'unit_price_display'-'secondary_headline',updated_at=now()
where slug in ('summer-1x','summer-2x','summer-3x');
get diagnostics affected=row_count;
if affected<>3 then raise exception 'Expected 3 product text updates, got %',affected; end if;
update public.collaborators set campaign_code='CHAVOLIN',updated_at=now() where slug='chavolines';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'Expected 1 collaboration update, got %',affected; end if;
update public.coupons set status='active',discount_type='percent',percent_off=10,
 description='Código privado de atribución. 10% en SUMMER 1X, 2X y 3X. Distribución exclusiva de Chava & Nat.',
 collaborator_id=(select id from public.collaborators where slug='chavolines'),
 eligible_variant_ids=array(select id from public.product_variants where sku in ('LUZ-SUMMER-1X','LUZ-SUMMER-2X','LUZ-SUMMER-3X') order by sku),
 updated_at=now()
where collaborator_id=(select id from public.collaborators where slug='chavolines');
get diagnostics affected=row_count;
if affected<>1 then raise exception 'Expected 1 coupon update, got %',affected; end if;
end $$;

create or replace function public.validate_collab_order() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.coupons; v public.product_variants; used bigint; email_value text; expected integer;
begin
 if tg_op='UPDATE' then
  if old.collaborator_id is not null or old.coupon_id is not null then
   if row(new.subtotal_cents,new.discount_cents,new.shipping_cents,new.tax_cents,new.total_cents,new.coupon_id,new.discount_code,new.discount_type,new.discount_value,new.subtotal_after_discount_cents,new.collaborator_id,new.campaign_code,new.collab_attribution_reason,new.metadata->'collab')
    is distinct from row(old.subtotal_cents,old.discount_cents,old.shipping_cents,old.tax_cents,old.total_cents,old.coupon_id,old.discount_code,old.discount_type,old.discount_value,old.subtotal_after_discount_cents,old.collaborator_id,old.campaign_code,old.collab_attribution_reason,old.metadata->'collab') then
    raise exception 'immutable_collab_order_snapshot';
   end if;
  end if;
  return new;
 end if;
 if new.coupon_id is null then
  if exists(select 1 from public.collaborators where id=new.collaborator_id and campaign_code='CHAVOLIN') then
   raise exception 'promo_redemption_required';
  end if;
  return new;
 end if;
 select * into c from public.coupons where id=new.coupon_id for update;
 if c.id is null or c.status<>'active' or c.deleted_at is not null or c.discount_type<>'percent'
 or c.percent_off is null or (c.starts_at is not null and now()<c.starts_at) or (c.ends_at is not null and now()>=c.ends_at)
 or not exists(select 1 from public.collaborators where id=c.collaborator_id and status='active') then raise exception 'promo_unavailable'; end if;
 select * into v from public.product_variants where id=(new.metadata->>'checkout_variant_id')::uuid;
 if v.id is null or not(v.id=any(c.eligible_variant_ids)) or v.offer_active
 or coalesce((v.metadata->>'units_per_pack')::integer,1)>=10 or v.metadata->>'campaign'='wholesale'
 or new.subtotal_cents<c.minimum_subtotal_cents then raise exception 'promo_ineligible'; end if;
 select lower(email) into email_value from public.customers where id=new.customer_id;
 if cardinality(c.allowed_customer_emails)>0 and not(email_value=any(c.allowed_customer_emails)) then raise exception 'promo_customer_restricted'; end if;
 -- Limits count created attempts (including unpaid); conservative and race-safe, no oversubscription.
 select count(*) into used from public.orders where coupon_id=c.id;
 if c.max_redemptions is not null and used>=c.max_redemptions then raise exception 'promo_usage_limit'; end if;
 select count(*) into used from public.orders where coupon_id=c.id and customer_id=new.customer_id;
 if c.per_customer_limit is not null and used>=c.per_customer_limit then raise exception 'promo_customer_limit'; end if;
 expected=round(new.subtotal_cents*c.percent_off/100);
 if new.discount_cents<>expected or new.total_cents<>new.subtotal_cents-expected+new.shipping_cents+new.tax_cents
 or new.subtotal_after_discount_cents<>new.subtotal_cents-expected or new.discount_code is distinct from c.code::text
 or new.discount_value is distinct from c.percent_off or new.discount_type is distinct from 'percentage'
 or new.collaborator_id is distinct from c.collaborator_id then raise exception 'promo_snapshot_mismatch'; end if;
 if exists(select 1 from public.collaborators where id=c.collaborator_id and campaign_code='CHAVOLIN') then
  if new.campaign_code is distinct from 'CHAVOLIN' or new.collab_attribution_reason is distinct from 'coupon'
  or new.metadata->'collab'->>'source' is distinct from 'El Mundo en Pareja'
  or new.metadata->'collab'->>'collaborators' is distinct from 'Chava & Nat'
  or new.metadata->'collab'->>'campaign' is distinct from 'CHAVOLIN'
  or new.metadata->'collab'->>'code' is distinct from c.code::text then
   raise exception 'promo_attribution_mismatch';
  end if;
  if (new.metadata->>'pack_quantity')::integer is null
  or (new.metadata->>'pack_quantity')::integer not between 1 and 10
  or new.subtotal_cents <> v.price_cents * (new.metadata->>'pack_quantity')::integer then
   raise exception 'promo_price_changed';
  end if;
 end if;
 return new;
end $$;

create or replace function public.collab_report(target uuid, since_at timestamptz, until_at timestamptz, page_offset integer default 0, page_size integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not(public.collab_is_admin() or public.collab_has_access(target)) then raise exception 'collab_access_denied' using errcode='42501'; end if;
 if since_at is null or until_at is null or until_at<=since_at or page_offset<0 or page_size<1 or page_size>500 then raise exception 'invalid_report_range'; end if;
 with sales as (
  select o.order_number,o.paid_at as date,o.status::text as status,o.fulfillment_status::text as fulfillment_status,
  o.subtotal_cents as gross_merchandise,o.discount_cents as discount,
  o.subtotal_cents-o.discount_cents as net_merchandise,o.shipping_cents as shipping,o.total_cents as total,
  o.collab_attribution_reason as source,
  coalesce((select sum(i.physical_units) from public.order_items i where i.order_id=o.id),0) as units,
  coalesce((select string_agg(i.name,', ' order by i.name) from public.order_items i where i.order_id=o.id),'') as product
  from public.orders o where o.collaborator_id=target and o.payment_status='paid' and o.status not in ('cancelled','refunded')
  -- New private-code campaign excludes the earlier public/auto-applied experiment.
  and (not exists(select 1 from public.collaborators c where c.id=target and c.campaign_code='CHAVOLIN')
       or (o.campaign_code='CHAVOLIN' and o.discount_code=(select cp.code::text from public.coupons cp where cp.id=o.coupon_id and cp.collaborator_id=target) and o.coupon_id is not null and o.discount_cents>0 and o.collab_attribution_reason='coupon'))
  and o.cancelled_at is null and o.refunded_at is null and o.paid_at>=since_at and o.paid_at<until_at
 ), paged as (select * from sales order by date desc,order_number desc limit page_size offset page_offset)
 select jsonb_build_object('orders',(select count(*) from sales),'gross_merchandise',coalesce((select sum(gross_merchandise) from sales),0),
 'discount',coalesce((select sum(discount) from sales),0),'net_merchandise',coalesce((select sum(net_merchandise) from sales),0),
 'shipping',coalesce((select sum(shipping) from sales),0),'total',coalesce((select sum(total) from sales),0),'units',coalesce((select sum(units) from sales),0),
 'aov',coalesce((select round(avg(net_merchandise)) from sales),0),'rows',coalesce((select jsonb_agg(to_jsonb(p)) from paged p),'[]'::jsonb),
 'sources',coalesce((select jsonb_agg(to_jsonb(s)) from (select source,count(*) as orders,sum(net_merchandise) as net_merchandise from sales group by source)s),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(to_jsonb(p)) from (select product,sum(units) as units,sum(net_merchandise) as net_merchandise from sales group by product)p),'[]'::jsonb)) into result;
 return result;
end $$;

-- CREATE OR REPLACE retains grants. Explicitly preserve private trigger/RPC boundaries.
revoke all on function public.validate_collab_order() from public,anon,authenticated,service_role;
revoke all on function public.collab_report(uuid,timestamptz,timestamptz,integer,integer) from public,anon;
grant execute on function public.collab_report(uuid,timestamptz,timestamptz,integer,integer) to authenticated,service_role;
commit;

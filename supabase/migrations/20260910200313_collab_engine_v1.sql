-- Additive V1. Existing payment, shipping and inventory functions are untouched.
create table public.collaborators (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 display_name text not null, brand_name text not null, campaign_code text not null unique,
 status text not null default 'active' check(status in ('active','inactive')),
 commission_percent numeric check(commission_percent between 0 and 100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.collaborator_members (
 id uuid primary key default gen_random_uuid(),
 collaborator_id uuid not null references public.collaborators(id),
 user_id uuid references auth.users(id), email text not null check(email=lower(trim(email))),
 display_name text not null, role text not null default 'viewer' check(role in ('viewer','manager')),
 status text not null default 'active' check(status in ('active','revoked')),
 invited_at timestamptz, accepted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(collaborator_id,email), unique(collaborator_id,user_id)
);
create index collaborator_members_user_idx on public.collaborator_members(user_id);
alter table public.coupons add column collaborator_id uuid references public.collaborators(id),
 add column eligible_variant_ids uuid[] not null default '{}',
 add column minimum_subtotal_cents integer not null default 0 check(minimum_subtotal_cents>=0),
 add column allowed_customer_emails text[] not null default '{}';
alter table public.orders add column collaborator_id uuid references public.collaborators(id),
 add column campaign_code text, add column discount_code text, add column discount_type text,
 add column discount_value numeric, add column subtotal_after_discount_cents integer,
 add column collab_attribution_reason text check(collab_attribution_reason in ('referral','coupon','both')),
 add column commission_amount_cents integer;
create index orders_collaborator_paid_idx on public.orders(collaborator_id,paid_at) where collaborator_id is not null;

create function public.collab_is_admin(write_access boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=(select auth.uid()) and active
 and (not write_access or role in ('owner','admin')));
$$;
-- Email is verified in auth.users and matched to a Google identity; user_metadata is never trusted.
create function public.collab_has_access(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.collaborator_members m join public.collaborators c on c.id=m.collaborator_id
 join auth.users u on u.id=(select auth.uid())
 where m.collaborator_id=target and m.status='active' and c.status='active'
 and m.email=lower(u.email) and u.email_confirmed_at is not null
 and (m.user_id is null or m.user_id=u.id)
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google'
 and lower(i.identity_data->>'email')=lower(u.email)));
$$;
alter table public.collaborators enable row level security;
alter table public.collaborator_members enable row level security;
revoke all on public.collaborators,public.collaborator_members from anon,authenticated;
grant select,insert,update on public.collaborators,public.collaborator_members to authenticated;
grant all on public.collaborators,public.collaborator_members to service_role;
create policy collab_read on public.collaborators for select to authenticated using(public.collab_is_admin() or public.collab_has_access(id));
create policy collab_insert on public.collaborators for insert to authenticated with check(public.collab_is_admin(true));
create policy collab_update on public.collaborators for update to authenticated using(public.collab_is_admin(true)) with check(public.collab_is_admin(true));
create policy member_read on public.collaborator_members for select to authenticated using(public.collab_is_admin() or (user_id=auth.uid() and public.collab_has_access(collaborator_id)));
create policy member_insert on public.collaborator_members for insert to authenticated with check(public.collab_is_admin(true));
create policy member_update on public.collaborator_members for update to authenticated using(public.collab_is_admin(true)) with check(public.collab_is_admin(true));
-- Harden coupon writes to match existing application owner/admin authorization.
drop policy if exists "admins can insert" on public.coupons;
drop policy if exists "admins can update" on public.coupons;
drop policy if exists "admins can delete" on public.coupons;
create policy coupon_insert on public.coupons for insert to authenticated with check(public.collab_is_admin(true));
create policy coupon_update on public.coupons for update to authenticated using(public.collab_is_admin(true)) with check(public.collab_is_admin(true));

create function public.accept_collab_membership() returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.collaborator_members m set user_id=auth.uid(),accepted_at=coalesce(accepted_at,now()),updated_at=now()
 where public.collab_has_access(m.collaborator_id) and (m.user_id is null or m.user_id=auth.uid())
 and m.email=(select lower(email) from auth.users where id=auth.uid()) and m.status='active';
 get diagnostics n=row_count; return n;
end $$;

create function public.collab_audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor_user_id,action,table_name,row_id,before_data,after_data)
 values(auth.uid(), 'collab_'||lower(tg_op),tg_table_name,new.id,
 case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 new.updated_at=now(); return new;
end $$;
create trigger collab_audit before insert or update on public.collaborators for each row execute function public.collab_audit_change();
create trigger member_audit before insert or update on public.collaborator_members for each row execute function public.collab_audit_change();
create trigger coupon_collab_audit before insert or update on public.coupons for each row when(new.collaborator_id is not null) execute function public.collab_audit_change();

-- Authoritative enforcement at order insertion: serializes usage checks and rejects stale quotes.
create function public.validate_collab_order() returns trigger
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
 if new.coupon_id is null then return new; end if;
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
 return new;
end $$;
create trigger collab_order_guard before insert or update on public.orders for each row execute function public.validate_collab_order();

-- Safe report projection is the only order access granted to members. No PII/metadata leaves this RPC.
create function public.collab_report(target uuid, since_at timestamptz, until_at timestamptz, page_offset integer default 0, page_size integer default 100)
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
revoke all on function public.collab_is_admin(boolean),public.collab_has_access(uuid),public.accept_collab_membership(),public.collab_report(uuid,timestamptz,timestamptz,integer,integer),public.collab_audit_change(),public.validate_collab_order() from public,anon;
grant execute on function public.collab_is_admin(boolean),public.collab_has_access(uuid),public.accept_collab_membership(),public.collab_report(uuid,timestamptz,timestamptz,integer,integer) to authenticated,service_role;
insert into public.collaborators(slug,display_name,brand_name,campaign_code)
values('chavolines','El Mundo en Pareja','LUZELA × CHAVOLINES','luzela_x_chavolines');
-- Initial seeding requires the private code via a session setting; never commit its value.
insert into public.coupons(code,status,description,discount_type,percent_off,collaborator_id,eligible_variant_ids)
select nullif(current_setting('luzela.private_collab_code',true),''),'active','10% en mercancía elegible. Sin acumulación ni mayoreo.','percent',10,id,
array(select v.id from public.product_variants v join public.products p on p.id=v.product_id where p.slug in ('summer-1x','summer-2x'))
from public.collaborators where slug='chavolines';

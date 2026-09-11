-- Isolated PGlite only. Never insert test purchases into production.
begin;
insert into auth.users(id,email,email_confirmed_at) values ('aaaaaaaa-0000-4000-8000-000000000003','owner-pricing@example.invalid',now());
insert into public.admin_users(user_id,email,role) values ('aaaaaaaa-0000-4000-8000-000000000003','owner-pricing@example.invalid','owner');
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000003',true);
create function pg_temp.place_order(sku_value text, qty integer default 1) returns uuid language plpgsql as $$
declare v public.product_variants; c public.coupons; order_id uuid; subtotal integer;
begin
 select * into v from public.product_variants where sku=sku_value;
 select * into c from public.coupons where code='TEST-COLLAB10';
 subtotal=v.price_cents*qty;
 insert into public.orders(collaborator_id,campaign_code,coupon_id,discount_code,discount_type,discount_value,subtotal_cents,discount_cents,subtotal_after_discount_cents,total_cents,collab_attribution_reason,status,payment_status,paid_at,metadata)
 values(c.collaborator_id,'CHAVOLIN',c.id,c.code,'percentage',10,subtotal,round(subtotal*.1),round(subtotal*.9),round(subtotal*.9),'coupon','paid','paid',now(),
 jsonb_build_object('checkout_variant_id',v.id,'pack_quantity',qty,'collab',jsonb_build_object('source','El Mundo en Pareja','collaborators','Chava & Nat','campaign','CHAVOLIN','code',c.code))) returning id into order_id;
 insert into public.order_items(order_id,variant_id,sku,name,quantity,unit_price_cents,subtotal_cents,physical_units)
 values(order_id,v.id,v.sku,v.name,qty,v.price_cents,subtotal,(v.metadata->>'units_per_pack')::int*qty);
 return order_id;
end $$;
do $$ declare r record; id_value uuid; report jsonb; target uuid; expected_prices integer[]:=array[45900,76900,81900]; expected_totals integer[]:=array[41310,69210,73710]; i integer:=0;
begin
 for r in select * from public.product_variants where sku like 'LUZ-SUMMER-%' order by sku loop
  i=i+1;
  if r.price_cents<>expected_prices[i] or r.offer_active or r.offer_price_cents is not null or r.compare_at_price_cents is not null then raise exception 'TEST: wrong canonical pricing'; end if;
  id_value=pg_temp.place_order(r.sku);
  if (select total_cents from public.orders where id=id_value)<>expected_totals[i] then raise exception 'TEST: wrong discount total'; end if;
 end loop;
 if i<>3 then raise exception 'TEST: missing packs'; end if;
 if exists(select 1 from public.products where slug like 'summer-%' and (attributes ? 'unit_price_display' or attributes ? 'secondary_headline')) then raise exception 'TEST: stale price copy'; end if;
 select id into target from public.collaborators where slug='chavolines';
 if not exists(select 1 from public.orders where order_number='TEST-PREVIOUS-PUBLIC10' and campaign_code='luzela_x_chavolines' and total_cents=35100 and collab_attribution_reason='both') then raise exception 'TEST: history rewritten'; end if;
 -- Organic purchase remains valid and has no collaboration association.
 insert into public.orders(subtotal_cents,total_cents,status,payment_status,paid_at) values(81900,81900,'paid','paid',now());
 -- Created-but-unpaid redemption must not count as a sale.
 id_value=pg_temp.place_order('LUZ-SUMMER-1X',2);
 update public.orders set status='pending_payment',payment_status='requires_payment',paid_at=null where id=id_value;
 report=public.collab_report(target,now()-interval '1 day',now()+interval '1 day');
 if (report->>'orders')::int<>3 or (report->>'gross_merchandise')::int<>204700 or (report->>'discount')::int<>20470
 or (report->>'net_merchandise')::int<>184230 or (report->>'units')::int<>6 or (report->>'aov')::int<>61410
 or jsonb_array_length(report->'products')<>3 then raise exception 'TEST: private campaign aggregation incorrect: %',report; end if;
 -- New referral-only attribution must be rejected even if an application tries to insert it.
 begin
  insert into public.orders(collaborator_id,subtotal_cents,total_cents,collab_attribution_reason) values(target,45900,45900,'referral');
  raise exception 'TEST: referral assigned a collaborator';
 exception when raise_exception then if sqlerrm<>'promo_redemption_required' then raise; end if; end;
 -- Database still enforces exact source/campaign instead of trusting checkout metadata.
 begin
  insert into public.orders(collaborator_id,coupon_id,discount_code,discount_type,discount_value,subtotal_cents,discount_cents,subtotal_after_discount_cents,total_cents,metadata)
  select collaborator_id,id,code,'percentage',10,45900,4590,41310,41310,'{"checkout_variant_id":"193a1b97-0cc7-45bf-b4cd-84092a2a8ab8"}' from public.coupons where code='TEST-COLLAB10';
  raise exception 'TEST: missing attribution accepted';
 exception when raise_exception then if sqlerrm<>'promo_attribution_mismatch' then raise; end if; end;
 -- Historical snapshots remain immutable; normal payment/status transitions remain possible.
 begin update public.orders set total_cents=1 where id=id_value;
  raise exception 'TEST: snapshot changed';
 exception when raise_exception then if sqlerrm<>'immutable_collab_order_snapshot' then raise; end if; end;
 if has_function_privilege('authenticated','public.validate_collab_order()','execute') or has_function_privilege('anon','public.collab_report(uuid,timestamptz,timestamptz,integer,integer)','execute') then raise exception 'TEST: grants regression'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin
  if exists(select 1 from public.coupons) then raise exception 'TEST: anonymous coupon enumeration'; end if;
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.coupons) then raise exception 'TEST: unauthorized coupon enumeration'; end if;
end $$;
reset role;
rollback;

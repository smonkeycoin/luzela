-- Run with npm run test:collab-db against an isolated PostgreSQL database. All fixture changes are rolled back.
begin;
do $$ begin
 if has_function_privilege('anon','public.collab_report(uuid,timestamptz,timestamptz,integer,integer)','execute') then raise exception 'TEST: anonymous report permission'; end if;
 if has_function_privilege('authenticated','public.collab_audit_change()','execute') or has_function_privilege('authenticated','public.validate_collab_order()','execute') then raise exception 'TEST: exposed trigger helper'; end if;
end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('aaaaaaaa-0000-4000-8000-000000000001','collab-test@example.invalid',now()),
 ('aaaaaaaa-0000-4000-8000-000000000002','other-test@example.invalid',now()),
 ('aaaaaaaa-0000-4000-8000-000000000003','owner-test@example.invalid',now());
insert into auth.identities(user_id,provider,identity_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','google','{"email":"collab-test@example.invalid"}'),
 ('aaaaaaaa-0000-4000-8000-000000000002','google','{"email":"other-test@example.invalid"}');
insert into public.admin_users(user_id,email,role) values('aaaaaaaa-0000-4000-8000-000000000003','owner-test@example.invalid','owner');
insert into public.collaborators(id,slug,display_name,brand_name,campaign_code) values('bbbbbbbb-0000-4000-8000-000000000002','other-test','Other','Other','other-test');
insert into public.collaborator_members(collaborator_id,email,display_name) select id,'collab-test@example.invalid','Test' from public.collaborators where slug='chavolines';
insert into public.collaborator_members(collaborator_id,email,display_name) values('bbbbbbbb-0000-4000-8000-000000000002','other-test@example.invalid','Other');
insert into public.products(id,slug,name,status) values('cccccccc-0000-4000-8000-000000000001','test-pack','Test pack','active');
insert into public.product_variants(id,product_id,sku,name,status,price_cents,metadata) values('dddddddd-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','TEST-COLLAB','Test variant','active',69000,'{"units_per_pack":1}');
insert into public.customers(id,email,phone,first_name) values('eeeeeeee-0000-4000-8000-000000000001','private-customer@example.invalid','PRIVATE-PHONE','PRIVATE-NAME');
update public.coupons set eligible_variant_ids=array['dddddddd-0000-4000-8000-000000000001'::uuid] where code='TEST-COLLAB10';
insert into public.orders(id,order_number,customer_id,collaborator_id,coupon_id,discount_code,discount_type,discount_value,subtotal_cents,discount_cents,subtotal_after_discount_cents,shipping_cents,total_cents,status,payment_status,paid_at,collab_attribution_reason,metadata)
select 'ffffffff-0000-4000-8000-000000000001','LZ-COLLAB-TEST','eeeeeeee-0000-4000-8000-000000000001',collaborator_id,id,'TEST-COLLAB10','percentage',10,69000,6900,62100,18900,81000,'paid','paid',now(),'both','{"checkout_variant_id":"dddddddd-0000-4000-8000-000000000001"}' from public.coupons where code='TEST-COLLAB10';
insert into public.order_items(order_id,variant_id,sku,name,quantity,unit_price_cents,subtotal_cents,physical_units) values('ffffffff-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','TEST-COLLAB','Test pack',1,69000,69000,1);
insert into public.orders(collaborator_id,subtotal_cents,total_cents,status,payment_status,paid_at) values('bbbbbbbb-0000-4000-8000-000000000002',99900,99900,'paid','paid',now());
do $$ begin
 begin update public.orders set discount_cents=1 where id='ffffffff-0000-4000-8000-000000000001'; raise exception 'TEST: immutable snapshot changed'; exception when raise_exception then if sqlerrm<>'immutable_collab_order_snapshot' then raise; end if; end;
 -- Status updates still work with the original commerce engine.
 update public.orders set fulfillment_status='preparing' where id='ffffffff-0000-4000-8000-000000000001';
end $$;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare n integer; report jsonb; target uuid; begin
 select public.accept_collab_membership() into n;
 if n<>1 then raise exception 'TEST: Google member acceptance failed'; end if;
 if not exists(select 1 from public.collaborator_members where user_id='aaaaaaaa-0000-4000-8000-000000000001' and last_login_at is not null) then raise exception 'TEST: last login not recorded'; end if;
 select id into target from public.collaborators where slug='chavolines';
 report=public.collab_report(target,now()-interval '1 day',now()+interval '1 day');
 if (report->>'orders')::int<>1 or (report->>'net_merchandise')::int<>62100 or (report->>'shipping')::int<>18900 or (report->>'total')::int<>81000 then raise exception 'TEST: financial semantics incorrect'; end if;
 if report::text like '%PRIVATE-%' or report::text like '%private-customer%' or report::text like '%customer_id%' then raise exception 'TEST: PII in report'; end if;
 if (select count(*) from public.collaborators)<>1 then raise exception 'TEST: cross-collab leak'; end if;
 if exists(select 1 from public.customers) or exists(select 1 from public.orders) then raise exception 'TEST: private data leaked'; end if;
 if public.collab_has_access('bbbbbbbb-0000-4000-8000-000000000002') then raise exception 'TEST: cross-collab access'; end if;
 begin
 perform public.collab_report('bbbbbbbb-0000-4000-8000-000000000002',now()-interval '1 day',now());
 raise exception 'TEST: cross-collab report allowed'; exception when insufficient_privilege then null; end;
 begin
 insert into public.collaborators(slug,display_name,brand_name,campaign_code) values('forbidden','Forbidden','Forbidden','forbidden');
 raise exception 'TEST: member write allowed'; exception when insufficient_privilege then null; end;
 update public.coupons set status='inactive';get diagnostics n=row_count;
 if n<>0 then raise exception 'TEST: member changed coupon'; end if;
 update public.orders set discount_cents=0;get diagnostics n=row_count;
 if n<>0 then raise exception 'TEST: member wrote orders'; end if;
end $$;
reset role;
update public.collaborator_members set status='revoked' where email='collab-test@example.invalid';
set local role authenticated;
do $$ begin if exists(select 1 from public.collaborators) then raise exception 'TEST: revoked member access'; end if; end $$;
reset role;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin if not public.collab_is_admin(true) then raise exception 'TEST: owner access denied'; end if; end $$;
reset role;
reset role;
create function pg_temp.try_coupon(expected_error text) returns void language plpgsql as $$
begin
 begin
 insert into public.orders(customer_id,collaborator_id,coupon_id,discount_code,discount_type,discount_value,subtotal_cents,discount_cents,subtotal_after_discount_cents,shipping_cents,total_cents,metadata)
 select customer_id,collaborator_id,coupon_id,discount_code,discount_type,discount_value,subtotal_cents,discount_cents,subtotal_after_discount_cents,shipping_cents,total_cents,metadata from public.orders where id='ffffffff-0000-4000-8000-000000000001';
 raise exception 'TEST: invalid coupon accepted';
 exception when raise_exception then if sqlerrm<>expected_error then raise; end if; end;
end $$;
update public.coupons set status='inactive' where code='TEST-COLLAB10';
select pg_temp.try_coupon('promo_unavailable');
update public.coupons set status='active',max_redemptions=1 where code='TEST-COLLAB10';
select pg_temp.try_coupon('promo_usage_limit');
update public.coupons set max_redemptions=null,per_customer_limit=1 where code='TEST-COLLAB10';
select pg_temp.try_coupon('promo_customer_limit');
update public.coupons set per_customer_limit=null where code='TEST-COLLAB10';
update public.product_variants set offer_active=true,offer_price_cents=60000 where id='dddddddd-0000-4000-8000-000000000001';
select pg_temp.try_coupon('promo_ineligible');
update public.product_variants set offer_active=false,metadata='{"units_per_pack":10,"campaign":"wholesale"}' where id='dddddddd-0000-4000-8000-000000000001';
select pg_temp.try_coupon('promo_ineligible');
rollback;

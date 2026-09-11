// Test-only database. No Supabase credentials or network connections.
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import fs from "node:fs";
export async function seedPricingCatalog(db) {
 await db.exec(fs.readFileSync("supabase/seed.sql", "utf8").replace(/^\\ir .*$/gm, ""));
 await db.exec(fs.readFileSync("supabase/summer_campaign.sql", "utf8"));
 // Fixed fixture IDs match existing browser tests; SQL never runs against a remote database.
 for (const [sku,id] of [
  ['LUZ-SUMMER-1X','193a1b97-0cc7-45bf-b4cd-84092a2a8ab8'],
  ['LUZ-SUMMER-2X','5967228b-715e-4f35-b6d8-a664547124ea'],
  ['LUZ-SUMMER-3X','5585efae-a6b2-4462-8ca7-707881a030c6'],
 ]) await db.query('update public.product_variants set id=$1 where sku=$2',[id,sku]);
 // Recreate the previous live prices/offer to verify the release actually upgrades them.
 await db.exec(`update public.product_variants set price_cents=case sku when 'LUZ-SUMMER-1X' then 39000 when 'LUZ-SUMMER-2X' then 65000 else 89000 end,
 offer_active=(sku='LUZ-SUMMER-3X'),offer_price_cents=case when sku='LUZ-SUMMER-3X' then 69000 else null end
 where sku like 'LUZ-SUMMER-%';
 update public.products set attributes=attributes||'{"unit_price_display":"$325 c/u","secondary_headline":"3 Luzelas por $690"}'::jsonb where slug like 'summer-%';`);
 // A paid order from V1 must remain intact but must not count in the new private campaign.
 await db.exec(`update public.coupons set eligible_variant_ids=array(select id from public.product_variants where sku='LUZ-SUMMER-1X') where code='TEST-COLLAB10';
 insert into public.orders(order_number,collaborator_id,campaign_code,coupon_id,discount_code,discount_type,discount_value,subtotal_cents,discount_cents,subtotal_after_discount_cents,total_cents,collab_attribution_reason,status,payment_status,paid_at,metadata)
 select 'TEST-PREVIOUS-PUBLIC10',collaborator_id,'luzela_x_chavolines',id,code,'percentage',10,39000,3900,35100,35100,'both','paid','paid',now(),'{"checkout_variant_id":"193a1b97-0cc7-45bf-b4cd-84092a2a8ab8"}'::jsonb from public.coupons where code='TEST-COLLAB10';`);
}
export async function createPricingFixture() {
 const db = new PGlite({extensions:{citext}});
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 alter default privileges in schema public grant execute on functions to authenticated;`);
  await db.exec(
    fs
      .readFileSync("supabase/schema.sql", "utf8")
      .replace("create extension if not exists pgcrypto;", ""),
  );
  await db.exec("select set_config('luzela.private_collab_code','TEST-COLLAB10',false)");
  for (const name of [
    "20260910200313_collab_engine_v1.sql",
    "20260910200422_collab_trigger_grants_hardening.sql",
  ]) {
    await db.exec(fs.readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
 await seedPricingCatalog(db);
 await db.exec(fs.readFileSync("supabase/migrations/20260911011625_pricing_18_private_chavolin.sql", "utf8"));
 return db;
}

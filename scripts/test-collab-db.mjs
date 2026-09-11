// Isolated PostgreSQL tests. Never connects to Supabase or creates real users/orders.
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import fs from "node:fs";
import { seedPricingCatalog } from "./lib/pricing-fixture.mjs";
const db = new PGlite({ extensions: { citext } });
try {
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
  await db.exec(fs.readFileSync("supabase/tests/collab_security.sql", "utf8"));
  console.log("PASS: existing collaboration security, RLS, immutable history and financial reporting.");
  await seedPricingCatalog(db);
  await db.exec(fs.readFileSync("supabase/migrations/20260911011625_pricing_18_private_chavolin.sql", "utf8"));
  await db.exec(fs.readFileSync("supabase/tests/private_pricing.sql", "utf8"));
  console.log("PASS: new prices, exact discounts, manual-only attribution, historical exclusion, unpaid exclusion and unchanged payment snapshots.");
} finally {
  await db.close();
}

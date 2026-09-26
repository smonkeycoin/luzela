import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createClient }));
import { recordCommerceEvent } from "./commerce";

afterEach(() => { mocks.createClient.mockReset(); });

describe("commerce analytics isolation", () => {
  it("does not throw when the analytics insert fails", async () => {
    mocks.createClient.mockReturnValue({ from: () => ({ insert: async () => ({ error: new Error("unavailable") }) }) });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(recordCommerceEvent({ event_name: "add_to_cart", anonymous_session_id: crypto.randomUUID() })).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith("commerce_analytics_write_failed", { event: "add_to_cart" });
    warning.mockRestore();
  });

  it("enforces one purchase row for repeated reconciliation and webhook delivery", async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role;");
      await db.exec("create table public.orders (id uuid primary key); create table public.checkout_sessions (id uuid primary key); create table public.products (id uuid primary key);");
      const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260926000141_commerce_funnel_observability.sql"), "utf8");
      await db.exec(sql);
      const id = crypto.randomUUID();
      const insert = `insert into public.commerce_events (event_name,event_key,order_id,environment) values ('purchase','purchase:${id}','${id}','production') on conflict (event_key) do nothing`;
      await db.exec(`insert into public.orders (id) values ('${id}')`);
      await db.exec(insert);
      await db.exec(insert);
      const result = await db.query<{ count: string }>("select count(*)::text as count from public.commerce_events where event_name='purchase'");
      expect(result.rows[0].count).toBe("1");
    } finally { await db.close(); }
  }, 30_000);
});

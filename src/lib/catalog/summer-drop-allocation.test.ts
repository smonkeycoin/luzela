import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20261002090000_summer_drop_allocation.sql",
);

describe("Summer Drop campaign allocation", () => {
  it("counts only paid packs once and releases failed checkouts", async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role;");
      await db.exec(`
        create table public.orders (
          id uuid primary key,
          status text not null,
          payment_status text not null,
          metadata jsonb not null default '{}'::jsonb
        );
      `);
      await db.exec(readFileSync(migrationPath, "utf8"));

      const paidOrderId = crypto.randomUUID();
      const failedOrderId = crypto.randomUUID();
      for (const id of [paidOrderId, failedOrderId]) {
        await db.query(
          `insert into public.orders (id, status, payment_status, metadata)
           values ($1, 'pending_payment', 'requires_payment', '{"campaign":"summer_drop"}')`,
          [id],
        );
        const { rows } = await db.query<{ claimed: boolean }>(
          "select public.claim_summer_drop_allocation($1, 1) as claimed",
          [id],
        );
        expect(rows[0].claimed).toBe(true);
      }

      await db.query(
        "update public.orders set status = 'paid', payment_status = 'paid' where id = $1",
        [paidOrderId],
      );
      // Replaying reconciliation may update the same order again; it cannot sell another slot.
      await db.query("update public.orders set status = 'paid' where id = $1", [paidOrderId]);
      await db.query(
        "update public.orders set status = 'cancelled', payment_status = 'failed' where id = $1",
        [failedOrderId],
      );

      const { rows: availability } = await db.query<{
        paid_packs: number;
        reserved_packs: number;
        remaining_packs: number;
      }>("select paid_packs, reserved_packs, remaining_packs from public.get_summer_drop_availability()");
      expect(availability[0]).toMatchObject({
        paid_packs: 1,
        reserved_packs: 0,
        remaining_packs: 24,
      });

      const { rows: claims } = await db.query<{ status: string }>(
        "select status from public.summer_drop_allocation_claims where order_id = $1",
        [failedOrderId],
      );
      expect(claims[0].status).toBe("released");
    } finally {
      await db.close();
    }
  }, 30_000);

  it("does not claim more than the campaign allocation", async () => {
    const db = new PGlite();
    try {
      await db.exec("create role anon; create role authenticated; create role service_role;");
      await db.exec(`
        create table public.orders (
          id uuid primary key,
          status text not null,
          payment_status text not null,
          metadata jsonb not null default '{}'::jsonb
        );
      `);
      await db.exec(readFileSync(migrationPath, "utf8"));
      await db.query("update public.summer_drop_campaigns set allocation = 1 where campaign_key = 'summer_drop'");

      const ids = [crypto.randomUUID(), crypto.randomUUID()];
      for (const id of ids) {
        await db.query(
          `insert into public.orders (id, status, payment_status, metadata)
           values ($1, 'pending_payment', 'requires_payment', '{"campaign":"summer_drop"}')`,
          [id],
        );
      }

      const first = await db.query<{ claimed: boolean }>(
        "select public.claim_summer_drop_allocation($1, 1) as claimed",
        [ids[0]],
      );
      const second = await db.query<{ claimed: boolean }>(
        "select public.claim_summer_drop_allocation($1, 1) as claimed",
        [ids[1]],
      );
      expect(first.rows[0].claimed).toBe(true);
      expect(second.rows[0].claimed).toBe(false);
    } finally {
      await db.close();
    }
  }, 30_000);
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/catalog/pack", () => ({
  getAvailablePacks: vi.fn(() => []),
  getPrimaryBundleComponent: vi.fn(() => null),
}));

vi.mock("@/lib/catalog/pricing", () => ({
  getDiscountCents: vi.fn(() => 0),
  getEffectivePriceCents: vi.fn((variant) => variant.price_cents || 0),
  getPricePerUnitCents: vi.fn((variant) => variant.price_cents || 0),
}));

import { getAdminOrders } from "./queries";

describe("admin queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes a reconciled paid Mercado Pago order in the admin orders list", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({
              data: [
                {
                  id: "order-1",
                  customer_id: "customer-1",
                  order_number: "LZ-123",
                  total_cents: 69000,
                  currency: "mxn",
                  payment_provider: "mercadopago",
                  payment_status: "paid",
                  fulfillment_status: "unfulfilled",
                  status: "paid",
                  created_at: "2026-08-13T03:40:35.000Z",
                  paid_at: "2026-08-13T04:00:00.000Z",
                  customers: {
                    email: "trinopc1@gmail.com",
                    phone: null,
                    first_name: "trino",
                    last_name: null,
                  },
                  order_items: [
                    {
                      name: "SUMMER 3X - 3 Luzelas",
                      quantity: 1,
                      units_per_pack: 3,
                      physical_units: 3,
                    },
                  ],
                  email_events: [{ status: "skipped", created_at: "2026-08-13T04:00:01.000Z" }],
                  shipments: [],
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    });

    const result = await getAdminOrders({ filter: "attention" });

    expect(result.error).toBeUndefined();
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      id: "order-1",
      payment_provider: "mercadopago",
      payment_status: "paid",
      physical_units: 3,
      email_status: "skipped",
    });
  });
});

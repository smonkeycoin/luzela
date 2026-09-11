import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reconcileMercadoPagoPayment: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/payments/reconcile-payment", () => ({
  reconcileMercadoPagoPayment: mocks.reconcileMercadoPagoPayment,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import { processMercadoPagoWebhook } from "./process-event";

type MockOptions = {
  insertError?: { code?: string; message?: string };
  payment?: {
    id: string;
    order_id: string;
    amount_cents: number;
    currency: string;
  } | null;
};

function createSupabaseMock({ insertError, payment }: MockOptions = {}) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

  return {
    updates,
    client: {
      from(table: string) {
        if (table === "payment_events") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: insertError ? null : { id: "event-row-1" },
                  error: insertError || null,
                })),
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => {
              updates.push({ table, values });
              return { eq: vi.fn(async () => ({ error: null })) };
            }),
          };
        }

        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              or: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data:
                    payment === undefined
                      ? {
                          id: "payment-1",
                          order_id: "order-1",
                          amount_cents: 89000,
                          currency: "mxn",
                        }
                      : payment,
                  error: null,
                })),
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => {
              updates.push({ table, values });
              return { eq: vi.fn(async () => ({ error: null })) };
            }),
          };
        }

        return {
          update: vi.fn((values: Record<string, unknown>) => {
            updates.push({ table, values });
            return { eq: vi.fn(async () => ({ error: null })) };
          }),
        };
      },
    },
  };
}

describe("Mercado Pago webhook processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reconcileMercadoPagoPayment.mockResolvedValue({
      provider: "mercadopago",
      providerOrderId: "ORD01LUZELA",
      providerPaymentId: "pay-1",
      orderId: "order-1",
      paymentId: "payment-1",
      status: "processed",
      statusDetail: "accredited",
      paid: true,
    });
  });

  it("deduplicates repeated provider events before fetching or fulfilling", async () => {
    const supabase = createSupabaseMock({
      insertError: { code: "23505", message: "duplicate key" },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await processMercadoPagoWebhook({
      dataId: "ORD01LUZELA",
      payload: { id: "evt-1", type: "order", action: "updated", data: { id: "ORD01LUZELA" } },
    });

    expect(result).toEqual({ ignored: false, duplicate: true, eventId: "evt-1" });
    expect(mocks.reconcileMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("ignores unknown provider orders without paid fulfillment", async () => {
    const supabase = createSupabaseMock({ payment: null });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.reconcileMercadoPagoPayment.mockResolvedValueOnce({
      provider: "mercadopago",
      providerOrderId: "ORD01UNKNOWN",
      providerPaymentId: null,
      orderId: null,
      paymentId: null,
      status: undefined,
      statusDetail: undefined,
      paid: false,
    });

    const result = await processMercadoPagoWebhook({
      dataId: "ORD01UNKNOWN",
      payload: { id: "evt-unknown", type: "order", data: { id: "ORD01UNKNOWN" } },
    });

    expect(result).toMatchObject({ orderId: null, paid: false });
  });

  it("uses the shared paid-order confirmation path exactly once for approved payments", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await processMercadoPagoWebhook({
      dataId: "ORD01LUZELA",
      payload: { id: "evt-approved", type: "order", data: { id: "ORD01LUZELA" } },
    });

    expect(result).toMatchObject({ orderId: "order-1", paid: true });
    expect(mocks.reconcileMercadoPagoPayment).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileMercadoPagoPayment).toHaveBeenCalledWith({
      providerOrderId: "ORD01LUZELA",
      paymentEventId: "event-row-1",
      eventType: "order",
      providerEventId: "evt-approved",
      payload: { id: "evt-approved", type: "order", data: { id: "ORD01LUZELA" } },
      source: "webhook",
    });
  });

  it("does not confirm unsupported payment statuses", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.reconcileMercadoPagoPayment.mockResolvedValueOnce({
      provider: "mercadopago",
      providerOrderId: "ORD01LUZELA",
      providerPaymentId: null,
      orderId: "order-1",
      paymentId: "payment-1",
      status: "processed",
      statusDetail: "rejected",
      paid: false,
    });

    const result = await processMercadoPagoWebhook({
      dataId: "ORD01LUZELA",
      payload: { id: "evt-declined", type: "order", data: { id: "ORD01LUZELA" } },
    });

    expect(result).toMatchObject({ paid: false });
  });
});

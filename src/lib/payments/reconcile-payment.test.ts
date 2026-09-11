import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMercadoPagoOrder: vi.fn(),
  confirmProviderPaidOrder: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/mercadopago/client", () => ({
  getMercadoPagoOrder: mocks.getMercadoPagoOrder,
}));

vi.mock("@/lib/payments/confirm-paid-order", () => ({
  confirmProviderPaidOrder: mocks.confirmProviderPaidOrder,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import {
  isMercadoPagoMexicoOrder,
  reconcileMercadoPagoPayment,
  reconcilePayment,
} from "./reconcile-payment";

type MockOptions = {
  order?: Record<string, unknown> | null;
  payment?: Record<string, unknown> | null;
  insertError?: { code?: string; message?: string };
};

function createSupabaseMock({ order, payment, insertError }: MockOptions = {}) {
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const orderRow =
    order === undefined
      ? {
          id: "order-1",
          total_cents: 69000,
          currency: "mxn",
          payment_provider: "mercadopago",
          payment_status: "pending_payment",
          provider_order_id: "ORD01LUZELA",
          provider_payment_id: null,
        }
      : order;
  const paymentRow =
    payment === undefined
      ? {
          id: "payment-1",
          order_id: "order-1",
          amount_cents: 69000,
          currency: "mxn",
          provider: "mercadopago",
          provider_order_id: "ORD01LUZELA",
          provider_payment_id: null,
          status: "requires_payment",
        }
      : payment;

  return {
    updates,
    inserts,
    client: {
      from(table: string) {
        if (table === "payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: paymentRow, error: null })),
                })),
                maybeSingle: vi.fn(async () => ({ data: paymentRow, error: null })),
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => {
              updates.push({ table, values });
              return { eq: vi.fn(async () => ({ error: null })) };
            }),
          };
        }

        if (table === "orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: orderRow, error: null })),
              })),
            })),
            update: vi.fn((values: Record<string, unknown>) => {
              updates.push({ table, values });
              return { eq: vi.fn(async () => ({ error: null })) };
            }),
          };
        }

        if (table === "payment_events") {
          return {
            insert: vi.fn((values: Record<string, unknown>) => {
              inserts.push({ table, values });
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: insertError ? null : { id: "event-1" },
                    error: insertError || null,
                  })),
                })),
              };
            }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: "event-existing" }, error: null })),
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

describe("payment reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMercadoPagoOrder.mockResolvedValue({
      id: "ORD01LUZELA",
      status: "processed",
      status_detail: "accredited",
      country_code: "MEX",
      external_reference: "order-1",
      total_amount: "690.00",
      transactions: {
        payments: [
          {
            id: "PAY01LUZELA",
            amount: "690.00",
            paid_amount: "690.00",
            status: "processed",
            status_detail: "accredited",
          },
        ],
      },
    });
  });

  it("accepts both Mercado Pago Mexico country code shapes", () => {
    expect(isMercadoPagoMexicoOrder("MX")).toBe(true);
    expect(isMercadoPagoMexicoOrder("MEX")).toBe(true);
    expect(isMercadoPagoMexicoOrder("AR")).toBe(false);
  });

  it("reconciles an accredited provider order through the paid-order path", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await reconcilePayment("order-1");

    expect(result).toMatchObject({
      orderId: "order-1",
      paid: true,
      providerOrderId: "ORD01LUZELA",
      providerPaymentId: "PAY01LUZELA",
    });
    expect(mocks.confirmProviderPaidOrder).toHaveBeenCalledTimes(1);
    expect(mocks.confirmProviderPaidOrder).toHaveBeenCalledWith({
      orderId: "order-1",
      checkoutSessionId: null,
      paymentIntentId: null,
      paymentEventId: "event-1",
    });
    expect(supabase.updates.find((update) => update.table === "payments")?.values).toMatchObject({
      status: "paid",
      provider_order_id: "ORD01LUZELA",
      provider_payment_id: "PAY01LUZELA",
    });
  });

  it("lets webhook reconciliation use its existing payment event", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    await reconcileMercadoPagoPayment({
      providerOrderId: "ORD01LUZELA",
      paymentEventId: "webhook-event-1",
      source: "webhook",
    });

    expect(supabase.inserts).toHaveLength(0);
    expect(mocks.confirmProviderPaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentEventId: "webhook-event-1" }),
    );
  });

  it("does not mark paid when provider order is not accredited", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.getMercadoPagoOrder.mockResolvedValueOnce({
      id: "ORD01LUZELA",
      status: "processed",
      status_detail: "pending",
      country_code: "MEX",
      external_reference: "order-1",
      total_amount: "690.00",
      transactions: {
        payments: [{ id: "PAY01LUZELA", amount: "690.00", status: "pending" }],
      },
    });

    const result = await reconcilePayment("order-1");

    expect(result.paid).toBe(false);
    expect(mocks.confirmProviderPaidOrder).not.toHaveBeenCalled();
    expect(supabase.updates.find((update) => update.table === "payments")?.values).toMatchObject({
      status: "requires_payment",
    });
  });

  it("rejects wrong provider amounts before confirming paid", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.getMercadoPagoOrder.mockResolvedValueOnce({
      id: "ORD01LUZELA",
      status: "processed",
      status_detail: "accredited",
      country_code: "MEX",
      external_reference: "order-1",
      total_amount: "689.00",
      transactions: {
        payments: [{ id: "PAY01LUZELA", amount: "690.00", status: "processed", status_detail: "accredited" }],
      },
    });

    await expect(reconcilePayment("order-1")).rejects.toThrow("mercadopago_amount_mismatch");
    expect(mocks.confirmProviderPaidOrder).not.toHaveBeenCalled();
  });

  it("rejects wrong external references before confirming paid", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.getMercadoPagoOrder.mockResolvedValueOnce({
      id: "ORD01LUZELA",
      status: "processed",
      status_detail: "accredited",
      country_code: "MEX",
      external_reference: "other-order",
      total_amount: "690.00",
      transactions: {
        payments: [{ id: "PAY01LUZELA", amount: "690.00", status: "processed", status_detail: "accredited" }],
      },
    });

    await expect(reconcilePayment("order-1")).rejects.toThrow(
      "mercadopago_external_reference_mismatch",
    );
    expect(mocks.confirmProviderPaidOrder).not.toHaveBeenCalled();
  });

  it("uses the existing reconciliation event when retried", async () => {
    const supabase = createSupabaseMock({
      insertError: { code: "23505", message: "duplicate key" },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    await reconcilePayment("order-1");

    expect(mocks.confirmProviderPaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentEventId: "event-existing" }),
    );
  });
});

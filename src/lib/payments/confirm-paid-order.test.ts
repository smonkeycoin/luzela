import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  sendAdminOrderAlertEmail: vi.fn(),
  sendOrderConfirmedEmail: vi.fn(),
  syncCustomerPaidOrderStats: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/email/send-admin-order-alert", () => ({
  sendAdminOrderAlertEmail: mocks.sendAdminOrderAlertEmail,
}));

vi.mock("@/lib/email/send-order-confirmed", () => ({
  sendOrderConfirmedEmail: mocks.sendOrderConfirmedEmail,
}));

vi.mock("@/lib/customers/sync-customer-stats", () => ({
  syncCustomerPaidOrderStats: mocks.syncCustomerPaidOrderStats,
}));

import { confirmProviderPaidOrder } from "./confirm-paid-order";

function createSupabaseMock({ beforePaymentStatus = "requires_payment" } = {}) {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  let orderSelectCount = 0;

  return {
    inserts,
    client: {
      rpc: vi.fn(async () => ({ error: null })),
      from(table: string) {
        if (table === "orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => {
                  orderSelectCount += 1;

                  if (orderSelectCount === 1) {
                    return {
                      data: { payment_status: beforePaymentStatus },
                      error: null,
                    };
                  }

                  return {
                    data: { id: "order-1", customer_id: "customer-1" },
                    error: null,
                  };
                }),
              })),
            })),
          };
        }

        if (table === "payment_events") {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }

        if (table === "audit_log") {
          return {
            insert: vi.fn(async (values: Record<string, unknown>) => {
              inserts.push({ table, values });
              return { error: null };
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };
}

describe("confirmProviderPaidOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendOrderConfirmedEmail.mockResolvedValue({
      sent: true,
      eventId: "customer-email-event",
    });
    mocks.sendAdminOrderAlertEmail.mockResolvedValue({
      sent: 2,
      failed: 0,
      skipped: 0,
      results: [{ eventId: "admin-email-event-1" }, { eventId: "admin-email-event-2" }],
    });
  });

  it("sends customer and admin emails once when an order first becomes paid", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    await confirmProviderPaidOrder({
      orderId: "order-1",
      checkoutSessionId: null,
      paymentIntentId: null,
      paymentEventId: "payment-event-1",
    });

    expect(mocks.syncCustomerPaidOrderStats).toHaveBeenCalledWith("customer-1");
    expect(mocks.sendOrderConfirmedEmail).toHaveBeenCalledWith({ orderId: "order-1" });
    expect(mocks.sendAdminOrderAlertEmail).toHaveBeenCalledWith({ orderId: "order-1" });
    expect(supabase.inserts.map((insert) => insert.values.action)).toEqual([
      "order_confirmation_email_sent",
      "admin_order_alert_sent",
    ]);
  });

  it("does not send emails again when the order was already paid", async () => {
    const supabase = createSupabaseMock({ beforePaymentStatus: "paid" });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    await confirmProviderPaidOrder({
      orderId: "order-1",
      checkoutSessionId: null,
      paymentIntentId: null,
      paymentEventId: "payment-event-1",
    });

    expect(mocks.syncCustomerPaidOrderStats).not.toHaveBeenCalled();
    expect(mocks.sendOrderConfirmedEmail).not.toHaveBeenCalled();
    expect(mocks.sendAdminOrderAlertEmail).not.toHaveBeenCalled();
    expect(supabase.inserts).toEqual([]);
  });

  it("does not block paid reconciliation when the admin alert fails", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.sendAdminOrderAlertEmail.mockRejectedValueOnce(new Error("resend_timeout"));

    await expect(
      confirmProviderPaidOrder({
        orderId: "order-1",
        checkoutSessionId: null,
        paymentIntentId: null,
        paymentEventId: "payment-event-1",
      }),
    ).resolves.toBeUndefined();

    expect(supabase.inserts.map((insert) => insert.values.action)).toEqual([
      "order_confirmation_email_sent",
      "admin_order_alert_failed",
    ]);
  });
});

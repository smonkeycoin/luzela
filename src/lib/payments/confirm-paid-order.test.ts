import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  sendAdminOrderAlertEmail: vi.fn(),
  sendOrderConfirmedEmail: vi.fn(),
  syncCustomerPaidOrderStats: vi.fn(),
  recordCommerceEvent: vi.fn(),
  orderEventContext: vi.fn(),
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

vi.mock("@/lib/analytics/commerce", () => ({
  recordCommerceEvent: mocks.recordCommerceEvent,
  orderEventContext: mocks.orderEventContext,
}));

import { confirmProviderPaidOrder } from "./confirm-paid-order";

function createSupabaseMock({ beforePaymentStatus = "requires_payment" } = {}) {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];

  return {
    inserts,
    client: {
      rpc: vi.fn(async () => ({ error: null })),
      from(table: string) {
        if (table === "orders") {
          return {
            select: vi.fn((fields: string) => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => {
                  if (fields.includes("subtotal_cents")) {
                    return { data: {
                      id: "order-1", payment_status: "paid", subtotal_cents: 81900,
                      discount_cents: 8190, shipping_cents: 0, total_cents: 73710,
                      currency: "mxn", discount_code: "CHAVOLIN10", metadata: {},
                      order_items: [{ product_id: "product-1", sku: "LUZ-SUMMER-3X", quantity: 1, units_per_pack: 3, subtotal_cents: 81900 }],
                    }, error: null };
                  }
                  if (fields === "payment_status") {
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
    mocks.recordCommerceEvent.mockResolvedValue(undefined);
    mocks.orderEventContext.mockResolvedValue({
      anonymous_session_id: "session-1", checkout_session_id: "checkout-1",
      is_qa: false, attribution: {},
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

  it("uses the same purchase key for repeated paid reconciliation and webhook delivery", async () => {
    const supabase = createSupabaseMock({ beforePaymentStatus: "paid" });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    const input = { orderId: "order-1", checkoutSessionId: null, paymentIntentId: null, paymentEventId: "payment-event-1" };

    await confirmProviderPaidOrder(input);
    await confirmProviderPaidOrder(input);

    expect(mocks.recordCommerceEvent).toHaveBeenCalledTimes(2);
    expect(mocks.recordCommerceEvent.mock.calls.map(([event]) => event.event_key)).toEqual([
      "purchase:order-1", "purchase:order-1",
    ]);
    expect(mocks.sendOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  it("continues paid reconciliation when the analytics write fails", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);
    mocks.recordCommerceEvent.mockRejectedValueOnce(new Error("analytics_unavailable"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(confirmProviderPaidOrder({
      orderId: "order-1", checkoutSessionId: null, paymentIntentId: null,
      paymentEventId: "payment-event-1",
    })).resolves.toBeUndefined();

    expect(mocks.sendOrderConfirmedEmail).toHaveBeenCalledWith({ orderId: "order-1" });
    expect(warning).toHaveBeenCalledWith("commerce_analytics_write_failed", { event: "purchase" });
    warning.mockRestore();
  });
});

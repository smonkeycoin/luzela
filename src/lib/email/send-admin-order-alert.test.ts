import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/email/transactional", () => ({
  EMAIL_EVENT_TYPES: {
    ADMIN_ORDER_ALERT: "ADMIN_ORDER_ALERT",
  },
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

import { sendAdminOrderAlertEmail } from "./send-admin-order-alert";

const paidOrder = {
  id: "order-1",
  order_number: "LZ-TEST",
  created_at: "2026-09-07T10:00:00.000Z",
  paid_at: "2026-09-07T10:01:00.000Z",
  total_cents: 69000,
  currency: "mxn",
  customer_id: "customer-1",
  customers: {
    email: "cliente@example.com",
    phone: "+529981234567",
    first_name: "Luz",
    last_name: "Cliente",
  },
  customer_addresses: {
    full_name: "Luz Cliente",
    phone: "+529981234567",
    line1: "Calle 1",
    line2: null,
    neighborhood: "Centro",
    city: "Cancun",
    state: "Quintana Roo",
    postal_code: "77500",
    country: "MX",
  },
  order_items: [
    {
      name: "SUMMER 3X",
      sku: "LUZ-SPF50-3X",
      quantity: 1,
      units_per_pack: 3,
      physical_units: 3,
      subtotal_cents: 69000,
    },
  ],
};

function createSupabaseMock({
  recipients,
}: {
  recipients: Array<{ email: string; role: string }>;
}) {
  return {
    from(table: string) {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: paidOrder, error: null })),
            })),
          })),
        };
      }

      if (table === "admin_users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({ data: recipients, error: null })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("sendAdminOrderAlertEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendTransactionalEmail.mockResolvedValue({ sent: true, eventId: "email-event-1" });
  });

  it("sends one idempotent paid-order alert per configured admin recipient", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        recipients: [
          { email: "OWNER@luzela.mx", role: "owner" },
          { email: "ops@luzela.mx", role: "operations" },
          { email: "owner@luzela.mx", role: "admin" },
        ],
      }),
    );

    const result = await sendAdminOrderAlertEmail({ orderId: "order-1" });

    expect(result).toMatchObject({ sent: 2, failed: 0, skipped: 0 });
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ADMIN_ORDER_ALERT",
        orderId: "order-1",
        recipient: "owner@luzela.mx",
        idempotencyKey: "admin_order_alert:order-1:owner@luzela.mx",
      }),
    );
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "ops@luzela.mx",
        idempotencyKey: "admin_order_alert:order-1:ops@luzela.mx",
      }),
    );
  });

  it("reports the exact blocker when no admin recipients are configured", async () => {
    mocks.createSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        recipients: [],
      }),
    );

    const result = await sendAdminOrderAlertEmail({ orderId: "order-1" });

    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      skipped: 0,
      reason: "admin_recipients_missing",
    });
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });
});

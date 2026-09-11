import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getEmailSettings: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn(function Resend() {
    return {
      emails: {
        send: mocks.send,
      },
    };
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("@/lib/settings", () => ({
  getEmailSettings: mocks.getEmailSettings,
}));

import { EMAIL_EVENT_TYPES, sendTransactionalEmail } from "./transactional";

function createSupabaseMock({
  existingEvent = null,
}: {
  existingEvent?: Record<string, unknown> | null;
} = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  let selectedById = false;

  return {
    updates,
    inserts,
    client: {
      from(table: string) {
        expect(table).toBe("email_events");

        return {
          insert: vi.fn((values: Record<string, unknown>) => {
            inserts.push(values);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: "email-event-1",
                    status: "pending",
                    attempt_count: 0,
                    idempotency_key: values.idempotency_key,
                    template_key: values.template_key,
                    event_type: values.event_type,
                    order_id: values.order_id,
                    recipient: values.recipient,
                  },
                  error: null,
                })),
              })),
            };
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => {
                selectedById = true;
                return { data: existingEvent, error: null };
              }),
            })),
          })),
          update: vi.fn((values: Record<string, unknown>) => {
            updates.push(values);
            return { eq: vi.fn(async () => ({ error: null })) };
          }),
        };
      },
    },
    get selectedById() {
      return selectedById;
    },
  };
}

const emailInput = {
  eventType: EMAIL_EVENT_TYPES.ORDER_CONFIRMATION,
  orderId: "order-1",
  customerId: "customer-1",
  recipient: "cliente@example.com",
  subject: "Recibimos tu pedido Luzela",
  html: "<p>Hola</p>",
  text: "Hola",
  payload: { order_number: "LZ-1" },
  idempotencyKey: "order_confirmation:order-1",
};

describe("transactional email service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM = "Luzela <orders@luzela.mx>";
    mocks.getEmailSettings.mockResolvedValue({
      transactionalEmailsEnabled: true,
      orderConfirmationEnabled: true,
      shippingConfirmationEnabled: true,
      from: "Luzela <orders@luzela.mx>",
      fromName: "Luzela",
      fromEmail: "orders@luzela.mx",
      replyTo: "",
    });
  });

  it("records skipped when Resend is not configured without throwing", async () => {
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail(emailInput);

    expect(result).toMatchObject({ sent: false, skipped: true, reason: "resend_not_configured" });
    expect(supabase.inserts).toHaveLength(1);
    expect(supabase.updates.find((update) => update.status === "skipped")).toMatchObject({
      status: "skipped",
      error_code: "resend_not_configured",
      attempt_count: 1,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("records skipped when app settings disable transactional emails", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mocks.getEmailSettings.mockResolvedValueOnce({
      transactionalEmailsEnabled: false,
      orderConfirmationEnabled: true,
      shippingConfirmationEnabled: true,
      from: "Luzela <orders@luzela.mx>",
      fromName: "Luzela",
      fromEmail: "orders@luzela.mx",
      replyTo: "",
    });
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail(emailInput);

    expect(result).toMatchObject({ sent: false, skipped: true, reason: "feature_disabled" });
    expect(supabase.updates.find((update) => update.status === "skipped")).toMatchObject({
      status: "skipped",
      error_code: "feature_disabled",
      attempt_count: 1,
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends through Resend and stores provider message id", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mocks.send.mockResolvedValue({ data: { id: "email-provider-1" }, error: null });
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail(emailInput);

    expect(result).toMatchObject({ sent: true, providerMessageId: "email-provider-1" });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Luzela <orders@luzela.mx>",
        to: "cliente@example.com",
        subject: "Recibimos tu pedido Luzela",
        html: "<p>Hola</p>",
        text: "Hola",
      }),
    );
    expect(supabase.updates.find((update) => update.status === "sent")).toMatchObject({
      status: "sent",
      provider_message_id: "email-provider-1",
      attempt_count: 1,
    });
  });

  it("stores sanitized failure details", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Bad key re_secret_value" },
    });
    const supabase = createSupabaseMock();
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail(emailInput);

    expect(result.failed).toBe(true);
    expect(supabase.updates.find((update) => update.status === "failed")).toMatchObject({
      status: "failed",
      error_code: "validation_error",
      error_message: "Bad key [redacted]",
    });
  });

  it("does not resend an existing event during duplicate triggers", async () => {
    const supabase = createSupabaseMock({
      existingEvent: {
        id: "email-event-1",
        status: "skipped",
        attempt_count: 1,
        idempotency_key: emailInput.idempotencyKey,
        template_key: "ORDER_CONFIRMATION",
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail(emailInput);

    expect(result).toMatchObject({ sent: false, skipped: true, reason: "already_recorded" });
    expect(supabase.updates).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("allows retry for skipped events and updates the same event", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mocks.send.mockResolvedValue({ data: { id: "email-provider-2" }, error: null });
    const supabase = createSupabaseMock({
      existingEvent: {
        id: "email-event-1",
        status: "skipped",
        attempt_count: 1,
        idempotency_key: emailInput.idempotencyKey,
        template_key: "ORDER_CONFIRMATION",
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail({ ...emailInput, retryEventId: "email-event-1" });

    expect(result.sent).toBe(true);
    expect(supabase.inserts).toHaveLength(0);
    expect(supabase.updates.find((update) => update.status === "sent")).toMatchObject({
      status: "sent",
      attempt_count: 2,
    });
    expect(supabase.updates[0]).toMatchObject({
      event_type: "ORDER_CONFIRMATION",
      recipient: "cliente@example.com",
    });
  });

  it("blocks retry for sent events", async () => {
    const supabase = createSupabaseMock({
      existingEvent: {
        id: "email-event-1",
        status: "sent",
        attempt_count: 1,
        idempotency_key: emailInput.idempotencyKey,
        template_key: "ORDER_CONFIRMATION",
      },
    });
    mocks.createSupabaseAdminClient.mockReturnValue(supabase.client);

    const result = await sendTransactionalEmail({ ...emailInput, retryEventId: "email-event-1" });

    expect(result).toMatchObject({ sent: false, blocked: true, reason: "already_sent" });
    expect(supabase.updates).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

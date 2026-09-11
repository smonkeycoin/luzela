import { Resend } from "resend";

import { getEmailSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const EMAIL_EVENT_TYPES = {
  ORDER_CONFIRMATION: "ORDER_CONFIRMATION",
  ADMIN_ORDER_ALERT: "ADMIN_ORDER_ALERT",
  SHIPPING_CONFIRMATION: "SHIPPING_CONFIRMATION",
  DELIVERED_CONFIRMATION: "DELIVERED_CONFIRMATION",
  REVIEW_REQUEST: "REVIEW_REQUEST",
} as const;

export type EmailEventType = (typeof EMAIL_EVENT_TYPES)[keyof typeof EMAIL_EVENT_TYPES];
export type EmailSendStatus = "pending" | "sent" | "failed" | "skipped";

type EmailEventRow = {
  id: string;
  status: EmailSendStatus | "queued" | "delivered";
  attempt_count: number | null;
  idempotency_key: string | null;
  template_key: string;
  event_type: string | null;
  order_id: string | null;
  recipient: string | null;
};

type SendTransactionalEmailInput = {
  eventType: EmailEventType;
  orderId: string;
  customerId?: string | null;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  retryEventId?: string;
};

export type TransactionalEmailResult = {
  sent: boolean;
  failed?: boolean;
  skipped?: boolean;
  blocked?: boolean;
  reason?: string;
  eventId?: string;
  providerMessageId?: string;
  error?: string;
};

export function getResendConfigStatus() {
  return {
    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    fromConfigured: Boolean(process.env.RESEND_FROM),
    from: process.env.RESEND_FROM || "Luzela <orders@luzela.mx>",
    replyTo: process.env.RESEND_REPLY_TO || "",
  };
}

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<TransactionalEmailResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { sent: false, skipped: true, reason: "supabase_not_configured" };
  }

  const existingEvent = input.retryEventId
    ? await getEmailEventById(input.retryEventId)
    : await getEmailEventByKey(input.idempotencyKey);

  if (existingEvent?.status === "sent") {
    return {
      sent: false,
      skipped: true,
      blocked: Boolean(input.retryEventId),
      reason: "already_sent",
      eventId: existingEvent.id,
    };
  }

  if (existingEvent && !input.retryEventId) {
    return {
      sent: false,
      skipped: true,
      reason: "already_recorded",
      eventId: existingEvent.id,
    };
  }

  const event = existingEvent || (await createPendingEmailEvent(input));
  await prepareEmailEventForAttempt(event, input);
  const emailSettings = await getEmailSettings();

  if (isEmailDisabled(input.eventType, emailSettings)) {
    await updateEmailEventResult({
      event,
      status: "skipped",
      errorCode: "feature_disabled",
      errorMessage: "Transactional email is disabled in app settings.",
    });

    return {
      sent: false,
      skipped: true,
      reason: "feature_disabled",
      eventId: event.id,
    };
  }

  const config = getResendConfigStatus();

  if (!config.apiKeyConfigured) {
    await updateEmailEventResult({
      event,
      status: "skipped",
      errorCode: "resend_not_configured",
      errorMessage: "RESEND_API_KEY is not configured.",
    });

    return {
      sent: false,
      skipped: true,
      reason: "resend_not_configured",
      eventId: event.id,
    };
  }

  const startedAt = Date.now();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: emailSettings.from,
      to: input.recipient,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(emailSettings.replyTo ? { replyTo: emailSettings.replyTo } : {}),
    });

    if (result.error) {
      const sanitized = sanitizeEmailError(result.error);

      await updateEmailEventResult({
        event,
        status: "failed",
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
      });

      logEmailResult({
        eventType: input.eventType,
        orderId: input.orderId,
        status: "failed",
        latencyMs: Date.now() - startedAt,
      });

      return {
        sent: false,
        failed: true,
        eventId: event.id,
        error: sanitized.message,
      };
    }

    await updateEmailEventResult({
      event,
      status: "sent",
      providerMessageId: result.data?.id,
    });

    logEmailResult({
      eventType: input.eventType,
      orderId: input.orderId,
      status: "sent",
      providerMessageId: result.data?.id,
      latencyMs: Date.now() - startedAt,
    });

    return {
      sent: true,
      eventId: event.id,
      providerMessageId: result.data?.id,
    };
  } catch (error) {
    const sanitized = sanitizeEmailError(error);

    await updateEmailEventResult({
      event,
      status: "failed",
      errorCode: sanitized.code,
      errorMessage: sanitized.message,
    });

    logEmailResult({
      eventType: input.eventType,
      orderId: input.orderId,
      status: "failed",
      latencyMs: Date.now() - startedAt,
    });

    return {
      sent: false,
      failed: true,
      eventId: event.id,
      error: sanitized.message,
    };
  }
}

function isEmailDisabled(
  eventType: EmailEventType,
  settings: Awaited<ReturnType<typeof getEmailSettings>>,
) {
  if (!settings.transactionalEmailsEnabled) {
    return true;
  }

  if (eventType === EMAIL_EVENT_TYPES.ORDER_CONFIRMATION) {
    return !settings.orderConfirmationEnabled;
  }

  if (eventType === EMAIL_EVENT_TYPES.SHIPPING_CONFIRMATION) {
    return !settings.shippingConfirmationEnabled;
  }

  return false;
}

async function createPendingEmailEvent(input: SendTransactionalEmailInput) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("email_events")
    .insert({
      customer_id: input.customerId || null,
      order_id: input.orderId,
      template_key: input.eventType,
      event_type: input.eventType,
      recipient: input.recipient,
      status: "pending",
      provider: "resend",
      idempotency_key: input.idempotencyKey,
      payload: input.payload,
    })
    .select("id, status, attempt_count, idempotency_key, template_key, event_type, order_id, recipient")
    .single();

  if (!error && data) {
    return data as EmailEventRow;
  }

  if (error?.code !== "23505") {
    throw error;
  }

  const existingEvent = await getEmailEventByKey(input.idempotencyKey);

  if (!existingEvent) {
    throw error;
  }

  return existingEvent;
}

async function getEmailEventByKey(idempotencyKey: string) {
  const supabase = createSupabaseAdminClient();

  const { data } = supabase
    ? await supabase
        .from("email_events")
        .select("id, status, attempt_count, idempotency_key, template_key, event_type, order_id, recipient")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()
    : { data: null };

  return (data || null) as EmailEventRow | null;
}

async function getEmailEventById(eventId: string) {
  const supabase = createSupabaseAdminClient();

  const { data } = supabase
    ? await supabase
        .from("email_events")
        .select("id, status, attempt_count, idempotency_key, template_key, event_type, order_id, recipient")
        .eq("id", eventId)
        .maybeSingle()
    : { data: null };

  return (data || null) as EmailEventRow | null;
}

async function updateEmailEventResult({
  event,
  status,
  providerMessageId,
  errorCode,
  errorMessage,
}: {
  event: EmailEventRow;
  status: EmailSendStatus;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const now = new Date().toISOString();

  await supabase
    .from("email_events")
    .update({
      status,
      provider: "resend",
      provider_message_id: providerMessageId || null,
      attempt_count: Number(event.attempt_count || 0) + 1,
      last_attempt_at: now,
      sent_at: status === "sent" ? now : null,
      error_code: errorCode || null,
      error_message: errorMessage || null,
    })
    .eq("id", event.id);
}

async function prepareEmailEventForAttempt(
  event: EmailEventRow,
  input: SendTransactionalEmailInput,
) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  await supabase
    .from("email_events")
    .update({
      customer_id: input.customerId || null,
      order_id: input.orderId,
      template_key: input.eventType,
      event_type: input.eventType,
      recipient: input.recipient,
      provider: "resend",
      idempotency_key: event.idempotency_key || input.idempotencyKey,
      payload: input.payload,
    })
    .eq("id", event.id);
}

function sanitizeEmailError(error: unknown) {
  const record = typeof error === "object" && error ? (error as Record<string, unknown>) : {};
  const code =
    typeof record.name === "string"
      ? record.name
      : typeof record.code === "string"
        ? record.code
        : "resend_error";
  const rawMessage =
    typeof record.message === "string"
      ? record.message
      : error instanceof Error
        ? error.message
        : "Resend request failed.";
  const message = rawMessage
    .replace(/re_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\\s+[^\\s]+/gi, "Bearer [redacted]")
    .slice(0, 280);

  return { code: code.slice(0, 80), message };
}

function logEmailResult({
  eventType,
  orderId,
  status,
  providerMessageId,
  latencyMs,
}: {
  eventType: EmailEventType;
  orderId: string;
  status: EmailSendStatus;
  providerMessageId?: string;
  latencyMs: number;
}) {
  const safeProviderMessageId = providerMessageId
    ? `${providerMessageId.slice(0, 6)}...${providerMessageId.slice(-4)}`
    : null;

  console.info("transactional_email", {
    eventType,
    orderId,
    status,
    providerMessageId: safeProviderMessageId,
    latencyMs,
  });
}

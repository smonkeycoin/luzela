import { reconcileMercadoPagoPayment } from "@/lib/payments/reconcile-payment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MercadoPagoWebhookPayload = {
  id?: string;
  action?: string;
  type?: string;
  live_mode?: boolean;
  data?: {
    id?: string;
  };
};

export async function processMercadoPagoWebhook({
  dataId,
  payload,
}: {
  dataId: string;
  payload: MercadoPagoWebhookPayload;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const providerOrderId = payload.data?.id || dataId;
  const eventId = payload.id || `${payload.type || "order"}:${providerOrderId}:${payload.action || "updated"}`;

  if (!providerOrderId) {
    return { ignored: true };
  }

  const { data: insertedEvent, error: insertError } = await supabase
    .from("payment_events")
    .insert({
      provider: "mercadopago",
      provider_event_id: eventId,
      event_type: payload.action || payload.type || "order.updated",
      payload: payload as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { ignored: false, duplicate: true, eventId };
    }

    throw insertError;
  }

  const result = await reconcileMercadoPagoPayment({
    providerOrderId,
    paymentEventId: insertedEvent.id as string,
    eventType: payload.action || payload.type || "order.updated",
    providerEventId: eventId,
    payload: payload as Record<string, unknown>,
    source: "webhook",
  });

  return {
    ignored: false,
    duplicate: false,
    eventId,
    orderId: result.orderId,
    paid: result.paid,
  };
}

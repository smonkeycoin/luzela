import { getMercadoPagoOrder, type MercadoPagoOrder } from "@/lib/mercadopago/client";
import { confirmProviderPaidOrder } from "@/lib/payments/confirm-paid-order";
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

function getApprovedPayment(order: MercadoPagoOrder) {
  const payments = order.transactions?.payments || [];

  return payments.find(
    (payment) =>
      payment.status === "processed" &&
      (!payment.status_detail || payment.status_detail === "accredited"),
  );
}

function amountMatches(expectedCents: number, providerAmount: string | undefined) {
  if (!providerAmount) {
    return false;
  }

  return Math.round(Number(providerAmount) * 100) === expectedCents;
}

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

  const providerOrder = await getMercadoPagoOrder(providerOrderId);
  const externalReference = providerOrder.external_reference || null;
  const approvedPayment = getApprovedPayment(providerOrder);

  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, amount_cents, currency")
    .or(
      externalReference
        ? `provider_order_id.eq.${providerOrder.id},order_id.eq.${externalReference}`
        : `provider_order_id.eq.${providerOrder.id}`,
    )
    .maybeSingle();

  if (!payment?.order_id) {
    await supabase
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", insertedEvent.id);

    return { ignored: false, duplicate: false, eventId, orderId: null };
  }

  const orderId = payment.order_id as string;
  const expectedAmountCents = payment.amount_cents as number;
  const amountValid = amountMatches(expectedAmountCents, providerOrder.total_amount);

  await supabase
    .from("payment_events")
    .update({
      order_id: orderId,
      payment_id: payment.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", insertedEvent.id);

  await Promise.all([
    supabase
      .from("orders")
      .update({
        payment_provider: "mercadopago",
        provider_order_id: providerOrder.id,
        provider_payment_id: approvedPayment?.id || null,
      })
      .eq("id", orderId),
    supabase
      .from("payments")
      .update({
        provider: "mercadopago",
        provider_order_id: providerOrder.id,
        provider_payment_id: approvedPayment?.id || null,
        status: approvedPayment && amountValid ? "paid" : "requires_payment",
      })
      .eq("id", payment.id),
    supabase
      .from("checkout_sessions")
      .update({
        provider: "mercadopago",
        provider_order_id: providerOrder.id,
        provider_payment_id: approvedPayment?.id || null,
      })
      .eq("order_id", orderId),
  ]);

  if (!amountValid) {
    throw new Error("mercadopago_amount_mismatch");
  }

  if (approvedPayment) {
    await confirmProviderPaidOrder({
      orderId,
      checkoutSessionId: null,
      paymentIntentId: null,
      paymentEventId: insertedEvent.id as string,
    });
  }

  return {
    ignored: false,
    duplicate: false,
    eventId,
    orderId,
    paid: Boolean(approvedPayment),
  };
}

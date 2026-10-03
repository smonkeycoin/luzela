import { getMercadoPagoOrder, type MercadoPagoOrder } from "@/lib/mercadopago/client";
import { confirmProviderPaidOrder } from "@/lib/payments/confirm-paid-order";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { orderEventContext, recordCommerceEvent } from "@/lib/analytics/commerce";

type PaymentRow = {
  id: string;
  order_id: string;
  amount_cents: number;
  currency: string;
  provider: string | null;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  status: string;
};

type OrderRow = {
  id: string;
  total_cents: number;
  currency: string;
  payment_provider: string | null;
  payment_status: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
};

type ReconcileSource = "admin" | "webhook";

type ReconcileMercadoPagoInput = {
  orderId?: string;
  providerOrderId?: string;
  paymentEventId?: string;
  eventType?: string;
  providerEventId?: string;
  payload?: Record<string, unknown>;
  source?: ReconcileSource;
};

export type ReconcilePaymentResult = {
  provider: "mercadopago";
  providerOrderId: string;
  providerPaymentId: string | null;
  orderId: string | null;
  paymentId: string | null;
  status: string | undefined;
  statusDetail: string | undefined;
  paid: boolean;
  duplicateEvent?: boolean;
};

export function getMercadoPagoApprovedPayment(order: MercadoPagoOrder) {
  const payments = order.transactions?.payments || [];

  return payments.find(
    (payment) =>
      payment.status === "processed" &&
      (!payment.status_detail || payment.status_detail === "accredited"),
  );
}

export function mercadoPagoAmountMatches(expectedCents: number, providerAmount: string | undefined) {
  if (!providerAmount) {
    return false;
  }

  return Math.round(Number(providerAmount) * 100) === expectedCents;
}

export function isMercadoPagoMexicoOrder(countryCode: string | undefined) {
  return countryCode === "MX" || countryCode === "MEX";
}

export async function reconcilePayment(orderId: string) {
  return reconcileMercadoPagoPayment({ orderId, source: "admin" });
}

export async function reconcileMercadoPagoPayment({
  orderId,
  providerOrderId,
  paymentEventId,
  eventType = "payment.reconciled",
  providerEventId,
  payload,
  source = "webhook",
}: ReconcileMercadoPagoInput): Promise<ReconcilePaymentResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { order, payment } = await findMercadoPagoInternalPayment({
    orderId,
    providerOrderId,
  });

  if (!order?.id || !payment?.id) {
    return {
      provider: "mercadopago",
      providerOrderId: providerOrderId || "",
      providerPaymentId: null,
      orderId: null,
      paymentId: null,
      status: undefined,
      statusDetail: undefined,
      paid: false,
    };
  }

  const expectedProviderOrderId = providerOrderId || order.provider_order_id || payment.provider_order_id;

  if (!expectedProviderOrderId) {
    throw new Error("mercadopago_provider_order_missing");
  }

  const providerOrder = await getMercadoPagoOrder(expectedProviderOrderId);
  const approvedPayment = getMercadoPagoApprovedPayment(providerOrder);
  const providerPaymentId = approvedPayment?.id || null;
  const expectedAmountCents = payment.amount_cents || order.total_cents;
  const orderStatusPaid =
    providerOrder.status === "processed" &&
    (!providerOrder.status_detail || providerOrder.status_detail === "accredited");
  const totalAmountValid = mercadoPagoAmountMatches(
    expectedAmountCents,
    providerOrder.total_amount,
  );
  const paymentAmountValid = approvedPayment
    ? mercadoPagoAmountMatches(expectedAmountCents, approvedPayment.amount || approvedPayment.paid_amount)
    : true;
  const countryValid = isMercadoPagoMexicoOrder(providerOrder.country_code);
  const currencyValid = String(payment.currency || order.currency).toLowerCase() === "mxn";
  const externalReferenceValid = providerOrder.external_reference === order.id;

  if (providerOrder.id !== expectedProviderOrderId) {
    throw new Error("mercadopago_provider_order_mismatch");
  }

  if (!externalReferenceValid) {
    throw new Error("mercadopago_external_reference_mismatch");
  }

  if (!totalAmountValid || !paymentAmountValid) {
    throw new Error("mercadopago_amount_mismatch");
  }

  if (!countryValid) {
    throw new Error("mercadopago_country_mismatch");
  }

  if (!currencyValid) {
    throw new Error("mercadopago_currency_mismatch");
  }

  const paid = Boolean(orderStatusPaid && approvedPayment);
  const eventRowId =
    paymentEventId ||
    (await insertReconciliationEvent({
      orderId: order.id,
      paymentId: payment.id,
      providerEventId:
        providerEventId || `reconcile:${providerOrder.id}:${providerPaymentId || "order"}`,
      eventType,
      payload: {
        source,
        provider_order_id: providerOrder.id,
        provider_payment_id: providerPaymentId,
        provider_status: providerOrder.status,
        provider_status_detail: providerOrder.status_detail,
        paid,
        ...(payload || {}),
      },
    }));

  await Promise.all([
    supabase
      .from("payment_events")
      .update({
        order_id: order.id,
        payment_id: payment.id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRowId),
    supabase
      .from("orders")
      .update({
        payment_provider: "mercadopago",
        provider_order_id: providerOrder.id,
        provider_payment_id: providerPaymentId,
      })
      .eq("id", order.id),
    supabase
      .from("payments")
      .update({
        provider: "mercadopago",
        provider_order_id: providerOrder.id,
        provider_payment_id: providerPaymentId,
        status: paid ? "paid" : "requires_payment",
      })
      .eq("id", payment.id),
    supabase
      .from("checkout_sessions")
      .update({
        provider: "mercadopago",
        provider_order_id: providerOrder.id,
        provider_payment_id: providerPaymentId,
      })
      .eq("order_id", order.id),
  ]);

  if (!paid && ["failed", "rejected", "cancelled"].includes(providerOrder.status || "")) {
    const { data: campaignOrder } = await supabase.from("orders")
      .select("metadata")
      .eq("id", order.id)
      .maybeSingle();
    const campaignMetadata = campaignOrder?.metadata && typeof campaignOrder.metadata === "object"
      ? campaignOrder.metadata as Record<string, unknown>
      : {};
    if (campaignMetadata.campaign === "summer_drop") {
      await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    }
  }

  if (paid || ["failed", "rejected", "cancelled"].includes(providerOrder.status || "")) {
    try {
      const context = await orderEventContext(order.id);
      const accepted = providerOrder.status === "processed" && paid;
      await recordCommerceEvent({
        event_name: accepted ? "payment_provider_accepted" : "payment_provider_rejected",
        event_key: `provider_result:${order.id}:${accepted ? "accepted" : "rejected"}`,
        order_id: order.id, checkout_session_id: context.checkout_session_id,
        anonymous_session_id: context.anonymous_session_id, is_qa: context.is_qa,
        ...context.attribution,
        metadata: { category: accepted ? "accepted" : String(providerOrder.status || "rejected").slice(0, 60) },
      });
    } catch { console.warn("commerce_analytics_write_failed", { event: "payment_provider_result" }); }
  }

  if (paid) {
    await confirmProviderPaidOrder({
      orderId: order.id,
      checkoutSessionId: null,
      paymentIntentId: null,
      paymentEventId: eventRowId,
    });
  }

  return {
    provider: "mercadopago",
    providerOrderId: providerOrder.id,
    providerPaymentId,
    orderId: order.id,
    paymentId: payment.id,
    status: providerOrder.status,
    statusDetail: providerOrder.status_detail,
    paid,
  };
}

async function findMercadoPagoInternalPayment({
  orderId,
  providerOrderId,
}: {
  orderId?: string;
  providerOrderId?: string;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const paymentQuery = supabase
    .from("payments")
    .select("id, order_id, amount_cents, currency, provider, provider_order_id, provider_payment_id, status");

  const { data: payment } = orderId
    ? await paymentQuery.eq("order_id", orderId).eq("provider", "mercadopago").maybeSingle()
    : await paymentQuery.eq("provider_order_id", providerOrderId).eq("provider", "mercadopago").maybeSingle();

  const resolvedOrderId = orderId || payment?.order_id;

  if (!resolvedOrderId) {
    return { order: null, payment: null };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, total_cents, currency, payment_provider, payment_status, provider_order_id, provider_payment_id")
    .eq("id", resolvedOrderId)
    .maybeSingle();

  return {
    order: (order || null) as OrderRow | null,
    payment: (payment || null) as PaymentRow | null,
  };
}

async function insertReconciliationEvent({
  orderId,
  paymentId,
  providerEventId,
  eventType,
  payload,
}: {
  orderId: string;
  paymentId: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data, error } = await supabase
    .from("payment_events")
    .insert({
      provider: "mercadopago",
      provider_event_id: providerEventId,
      event_type: eventType,
      order_id: orderId,
      payment_id: paymentId,
      payload,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    return data.id as string;
  }

  if (error?.code !== "23505") {
    throw error;
  }

  const { data: existingEvent, error: existingError } = await supabase
    .from("payment_events")
    .select("id")
    .eq("provider", "mercadopago")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();

  if (existingError || !existingEvent?.id) {
    throw existingError || error;
  }

  return existingEvent.id as string;
}

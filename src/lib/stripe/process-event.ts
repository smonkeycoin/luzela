import type Stripe from "stripe";

import { sendOrderConfirmedEmail } from "@/lib/email/send-order-confirmed";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const supportedEvents = new Set([
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
]);

export async function processStripeEvent(event: Stripe.Event) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  if (!supportedEvents.has(event.type)) {
    return { ignored: true };
  }

  const { data: insertedEvent, error: insertError } = await supabase
    .from("payment_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { ignored: false, duplicate: true, eventId: event.id };
    }

    throw insertError;
  }

  let orderId: string | null = null;

  if (event.type === "checkout.session.completed") {
    orderId = await handleCheckoutCompleted(event.data.object, insertedEvent.id);
  }

  if (event.type === "payment_intent.succeeded") {
    orderId = await handlePaymentIntentSucceeded(event.data.object, insertedEvent.id);
  }

  if (event.type === "payment_intent.payment_failed") {
    orderId = await handlePaymentIntentFailed(event.data.object, insertedEvent.id);
  }

  if (event.type === "charge.refunded") {
    orderId = await handleChargeRefunded(event.data.object, insertedEvent.id);
  }

  await supabase
    .from("payment_events")
    .update({ order_id: orderId, processed_at: new Date().toISOString() })
    .eq("id", insertedEvent.id);

  return { ignored: false, duplicate: false, eventId: event.id, orderId };
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  paymentEventId: string,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const orderId = session.metadata?.order_id || session.client_reference_id;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (!orderId) {
    return null;
  }

  await supabase
    .from("orders")
    .update({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", orderId);

  await supabase
    .from("payments")
    .update({
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("order_id", orderId);

  if (session.payment_status === "paid") {
    await confirmPaidOrder(orderId, session.id, paymentIntentId, paymentEventId);
  }

  return orderId;
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  paymentEventId: string,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const metadataOrderId = paymentIntent.metadata?.order_id || null;
  const { data: order } = await supabase
    .from("orders")
    .select("id, stripe_checkout_session_id")
    .or(
      metadataOrderId
        ? `stripe_payment_intent_id.eq.${paymentIntent.id},id.eq.${metadataOrderId}`
        : `stripe_payment_intent_id.eq.${paymentIntent.id}`,
    )
    .maybeSingle();

  if (!order?.id) {
    return null;
  }

  await supabase
    .from("orders")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", order.id);

  await supabase
    .from("payments")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("order_id", order.id);

  await confirmPaidOrder(
    order.id as string,
    (order.stripe_checkout_session_id as string | null) || null,
    paymentIntent.id,
    paymentEventId,
  );

  return order.id as string;
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  paymentEventId: string,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const metadataOrderId = paymentIntent.metadata?.order_id || null;
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .or(
      metadataOrderId
        ? `stripe_payment_intent_id.eq.${paymentIntent.id},id.eq.${metadataOrderId}`
        : `stripe_payment_intent_id.eq.${paymentIntent.id}`,
    )
    .maybeSingle();

  if (!order?.id) {
    return null;
  }

  await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      stripe_payment_intent_id: paymentIntent.id,
    })
    .eq("id", order.id);
  await supabase
    .from("payments")
    .update({
      status: "failed",
      stripe_payment_intent_id: paymentIntent.id,
      failure_code: paymentIntent.last_payment_error?.code || null,
      failure_message: paymentIntent.last_payment_error?.message || null,
    })
    .eq("order_id", order.id);

  await supabase
    .from("payment_events")
    .update({ order_id: order.id })
    .eq("id", paymentEventId);

  return order.id as string;
}

async function handleChargeRefunded(charge: Stripe.Charge, paymentEventId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;

  if (!paymentIntentId) {
    return null;
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!order?.id) {
    return null;
  }

  await supabase
    .from("orders")
    .update({
      status: "refunded",
      payment_status: "refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  await supabase
    .from("payments")
    .update({
      status: "refunded",
      stripe_charge_id: charge.id,
    })
    .eq("order_id", order.id);

  await supabase
    .from("payment_events")
    .update({ order_id: order.id })
    .eq("id", paymentEventId);

  return order.id as string;
}

async function confirmPaidOrder(
  orderId: string,
  checkoutSessionId: string | null,
  paymentIntentId: string | null,
  paymentEventId: string,
) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { data: beforeOrder } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();

  const { error } = await supabase.rpc("confirm_paid_order", {
    p_order_id: orderId,
    p_stripe_checkout_session_id: checkoutSessionId,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (error) {
    throw error;
  }

  await supabase
    .from("payment_events")
    .update({ order_id: orderId })
    .eq("id", paymentEventId);

  if (beforeOrder?.payment_status !== "paid") {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .single();

    if (order) {
      await sendOrderConfirmedEmail({ orderId });
    }
  }
}

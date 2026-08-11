import { NextResponse } from "next/server";
import { z } from "zod";

import {
  centsToMercadoPagoAmount,
  createMercadoPagoOrder,
} from "@/lib/mercadopago/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const mercadoPagoOrderRequestSchema = z.object({
  checkout_session_id: z.uuid(),
  token: z.string().min(8),
  payment_method_id: z.string().min(1),
  payment_method_type: z.string().min(1),
  installments: z.coerce.number().int().positive().max(48),
  payer: z.object({
    email: z.email(),
    identification: z.unknown().optional(),
  }),
});

function providerPaymentId(order: { transactions?: { payments?: Array<{ id?: string }> } }) {
  return order.transactions?.payments?.find((payment) => payment.id)?.id || null;
}

export async function POST(request: Request) {
  const parsed = mercadoPagoOrderRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_mercadopago_order_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 501 });
  }

  const { data: checkoutSession } = await supabase
    .from("checkout_sessions")
    .select("id, order_id, provider_order_id, email")
    .eq("id", parsed.data.checkout_session_id)
    .eq("provider", "mercadopago")
    .maybeSingle();

  if (!checkoutSession?.order_id) {
    return NextResponse.json({ error: "checkout_session_not_found" }, { status: 404 });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount_cents, currency, provider_order_id")
    .eq("order_id", checkoutSession.order_id)
    .eq("provider", "mercadopago")
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
  }

  if (payment.provider_order_id || checkoutSession.provider_order_id) {
    return NextResponse.json({ error: "provider_order_already_created" }, { status: 409 });
  }

  const amount = centsToMercadoPagoAmount(payment.amount_cents as number);
  let order;

  try {
    order = await createMercadoPagoOrder({
      idempotencyKey: `mp-order:${checkoutSession.id}`,
      totalAmount: amount,
      externalReference: checkoutSession.order_id as string,
      payer: {
        email: parsed.data.payer.email,
        identification: parsed.data.payer.identification,
      },
      payment: {
        amount,
        paymentMethodId: parsed.data.payment_method_id,
        paymentMethodType: parsed.data.payment_method_type,
        token: parsed.data.token,
        installments: parsed.data.installments,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "mercadopago_order_create_failed";

    return NextResponse.json(
      { error: message },
      { status: message === "mercadopago_access_token_missing" ? 501 : 502 },
    );
  }
  const paymentId = providerPaymentId(order);

  await Promise.all([
    supabase
      .from("orders")
      .update({
        payment_provider: "mercadopago",
        provider_order_id: order.id,
        provider_payment_id: paymentId,
      })
      .eq("id", checkoutSession.order_id),
    supabase
      .from("payments")
      .update({
        provider_order_id: order.id,
        provider_payment_id: paymentId,
      })
      .eq("id", payment.id),
    supabase
      .from("checkout_sessions")
      .update({
        provider_order_id: order.id,
        provider_payment_id: paymentId,
      })
      .eq("id", checkoutSession.id),
  ]);

  return NextResponse.json({
    ok: true,
    provider_order_id: order.id,
    status: order.status,
    status_detail: order.status_detail,
    next_url: "/checkout/success",
  });
}

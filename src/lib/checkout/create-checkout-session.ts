import { quotePromo } from '@/lib/collabs/quote';
import { z } from "zod";

import { getCheckoutProduct } from "@/lib/catalog/get-checkout-product";
import { getAppUrl } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getShippingPolicy } from "@/lib/settings";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  parseAttributionPayload,
  toOrderAttributionSnapshot,
  type AttributionOrderSnapshot,
} from "@/lib/attribution";

import { createAttemptSignature, isSameAttemptSignature } from "./idempotency";
import { isSummerDropProduct, SUMMER_DROP } from "@/lib/catalog/summer-drop";

const checkoutInputSchema = z.object({
  email: z.email(),
  phone: z.string().min(7),
  full_name: z.string().trim().min(2),
  address_line1: z.string().trim().min(5),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  postal_code: z.string().trim().min(4),
  country: z.string().trim().length(2).default("MX"),
  product_variant_id: z.uuid(),
  quantity: z.number().int().positive().max(10).default(1),
  coupon_code: z.string().trim().max(64).optional(),
  idempotency_key: z.uuid(),
  attribution: z.string().trim().max(8000).optional(),
});

type CheckoutInput = z.infer<typeof checkoutInputSchema>;

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; detail: string };

type CheckoutSessionRow = {
  id: string;
  order_id: string | null;
  provider: string;
  provider_checkout_url: string | null;
  stripe_checkout_url: string | null;
  metadata?: Record<string, unknown> | null;
};

type PaymentRow = {
  id: string;
  order_id: string;
  provider: string;
  amount_cents: number;
  currency: string;
  status: string;
  idempotency_key: string | null;
};

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: "invalid_checkout_input",
      detail: "Server-side validation failed before touching the payment provider.",
    };
  }

  const paymentProvider = getPaymentProvider();
  const stripe = paymentProvider === "stripe" ? getStripe() : null;
  const supabase = createSupabaseAdminClient();

  if (!supabase || (paymentProvider === "stripe" && !stripe)) {
    return {
      ok: false,
      status: 501,
      error: "backend_not_configured",
      detail:
        "Missing Supabase service role or active payment provider secret in .env.local.",
    };
  }

  const payload = parsed.data;
  const attributionSnapshot = toOrderAttributionSnapshot(
    parseAttributionPayload(payload.attribution),
  );
  const { product, error: productError } = await getCheckoutProduct(
    payload.product_variant_id,
  );

  if (productError || !product) {
    return {
      ok: false,
      status: 404,
      error: "product_unavailable",
      detail: productError || "Product is unavailable.",
    };
  }

  const summerDrop = isSummerDropProduct(product);
  let summerDropReferral: Record<string, unknown> | null = null;
  if (summerDrop && payload.coupon_code?.trim().toUpperCase() === "CHAVOLIN10") {
    const { data: referral } = await supabase
      .from("coupons")
      .select("id, code, status, collaborator_id, collaborators(slug, campaign_code, brand_name, display_name, status)")
      .eq("code", "CHAVOLIN10")
      .maybeSingle();
    const collaborator = Array.isArray(referral?.collaborators) ? referral.collaborators[0] : referral?.collaborators;
    if (referral?.status === "active" && collaborator?.status === "active") {
      summerDropReferral = {
        code: "CHAVOLIN10",
        collaborator_id: referral.collaborator_id,
        slug: collaborator.slug,
        campaign_code: collaborator.campaign_code,
        brand_name: collaborator.brand_name,
        display_name: collaborator.display_name,
        discount_eligible: false,
      };
    }
  }

  const physicalUnitsRequired =
    payload.quantity * product.variant.units_per_pack;

  if (product.variant.physical_stock_on_hand < physicalUnitsRequired) {
    return {
      ok: false,
      status: 409,
      error: "insufficient_stock",
      detail: `Only ${product.variant.stock_on_hand} packs are available.`,
    };
  }

  if (summerDrop && product.variant.stock_on_hand < payload.quantity) {
    return {
      ok: false,
      status: 409,
      error: "summer_drop_unavailable",
      detail: "La cantidad seleccionada supera los Summer Drops disponibles.",
    };
  }

  const shippingCents = await getShippingCents(product.free_shipping);
  const effectivePriceCents = summerDrop ? SUMMER_DROP.priceCents : product.variant.effective_price_cents;
  const subtotalCents = (summerDrop ? SUMMER_DROP.regularPriceCents : effectivePriceCents) * payload.quantity;
  const promoResult = payload.coupon_code && !summerDrop ? await quotePromo(payload.coupon_code, product, payload.quantity, payload.email) : null;
  if (promoResult && !promoResult.ok) return {ok:false,status:400,error:'invalid_promo',detail:promoResult.error};
  const appliedPromo = promoResult?.ok ? promoResult : null;
  // Referral/UTM remains analytics context; only a validated manual coupon assigns a collaborator.
  const collab = appliedPromo?.collab || null;
  const reason = collab ? "coupon" : null;
  const discountCents = appliedPromo?.discountCents || (summerDrop ? SUMMER_DROP.discountCents * payload.quantity : 0);
  const taxCents = 0;
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
  const appUrl = getAppUrl();
  const attemptSignature = createAttemptSignature({
    address_line1: payload.address_line1,
    city: payload.city,
    country: payload.country,
    currency: product.variant.currency,
    customer_email: payload.email.toLowerCase(),
    full_name: payload.full_name,
    neighborhood: payload.neighborhood || null,
    payment_provider: paymentProvider,
    phone: payload.phone,
    physical_units: physicalUnitsRequired,
    postal_code: payload.postal_code,
    product_variant_id: product.variant.id,
    quantity: payload.quantity,
    state: payload.state,
    total_cents: totalCents,
    ...(appliedPromo ? { coupon_id: appliedPromo.promo.id, discount_cents: discountCents } : {}),
  });
  const reservation = await reserveCheckoutAttempt({
    appUrl,
    attemptSignature,
    payload,
    paymentProvider,
    supabase,
  });

  if (!reservation.ok) {
    return reservation.result;
  }

  if (reservation.result) {
    return reservation.result;
  }

  const checkoutReservation = reservation.checkoutSession;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      {
        email: payload.email,
        phone: payload.phone,
        first_name: payload.full_name.split(" ")[0] || payload.full_name,
        last_name: payload.full_name.split(" ").slice(1).join(" ") || null,
      },
      { onConflict: "email" },
    )
    .select("id")
    .single();

  if (customerError || !customer) {
    return dbError("customer_create_failed", customerError?.message);
  }

  const { data: address, error: addressError } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: customer.id,
      full_name: payload.full_name,
      phone: payload.phone,
      line1: payload.address_line1,
      neighborhood: payload.neighborhood || null,
      city: payload.city,
      state: payload.state,
      postal_code: payload.postal_code,
      country: payload.country,
      is_default_shipping: true,
    })
    .select("id")
    .single();

  if (addressError || !address) {
    return dbError("address_create_failed", addressError?.message);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      shipping_address_id: address.id,
      status: "pending_payment",
      payment_status: "requires_payment",
      payment_provider: paymentProvider,
      fulfillment_status: "unfulfilled",
      currency: product.variant.currency,
      subtotal_cents: subtotalCents,
      ...(collab ? {
        collaborator_id: collab.id, campaign_code: collab.campaign_code,
        collab_attribution_reason: reason, subtotal_after_discount_cents: subtotalCents - discountCents,
      } : {}),
      ...(appliedPromo ? { coupon_id: appliedPromo.promo.id, discount_code: appliedPromo.promo.code,
        discount_type: 'percentage', discount_value: Number(appliedPromo.promo.percent_off) } : {}),
      discount_cents: discountCents,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      metadata: {
        checkout_idempotency_key: payload.idempotency_key,
        product_slug: product.slug,
        checkout_variant_id: product.variant.id,
        ...(collab ? { collab: { id: collab.id, campaign: collab.campaign_code, name: collab.brand_name, source: collab.display_name,
          ...(collab.slug === "chavolines" ? { collaborators: "Chava & Nat" } : {}), reason,
          code: appliedPromo?.promo.code || null, referral_touch: parseAttributionPayload(payload.attribution)?.collab_touch || null, subtotal_before_discount: subtotalCents, discount_amount: discountCents,
          subtotal_after_discount: subtotalCents - discountCents, shipping_amount: shippingCents, total: totalCents } } : {}),
        pack_quantity: payload.quantity,
        units_per_pack: product.variant.units_per_pack,
        physical_units: physicalUnitsRequired,
        original_price_cents: product.variant.price_cents,
        offer_price_cents: product.variant.offer_price_cents,
        offer_active: product.variant.offer_active,
        effective_price_cents: effectivePriceCents,
        discount_cents: product.variant.discount_cents,
        attribution: attributionSnapshot,
        ...(summerDrop ? {
          campaign: SUMMER_DROP.campaign,
          promotion: {
            name: "SUMMER_DROP",
            gross_merchandise_cents: subtotalCents,
            discount_amount_cents: discountCents,
            net_merchandise_cents: subtotalCents - discountCents,
            shipping_collected_cents: 0,
            total_collected_cents: totalCents,
            pack_quantity: payload.quantity,
            physical_units: physicalUnitsRequired,
            ...(summerDropReferral ? { referral: summerDropReferral } : {}),
          },
          ...(summerDropReferral ? {
            collab_attribution_reason: "coupon_referral_only",
            collab_attribution: summerDropReferral,
          } : {}),
        } : {}),
      },
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    if (orderError?.message?.includes('promo_')) return {ok:false,status:400,error:'invalid_promo',detail:'El código cambió o ya no está disponible. Vuelve a validar tu compra.'};
    return dbError("order_create_failed", orderError?.message);
  }

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    variant_id: product.variant.id,
    inventory_variant_id: product.variant.inventory_variant_id,
    sku: product.variant.sku,
    name: `${product.name} - ${product.variant.name}`,
    quantity: payload.quantity,
    units_per_pack: product.variant.units_per_pack,
    physical_units: physicalUnitsRequired,
    unit_price_cents: effectivePriceCents,
    subtotal_cents: effectivePriceCents * payload.quantity,
    metadata: {
      analytics_item_id: product.variant.analytics_item_id,
      pack_quantity: payload.quantity,
      units_per_pack: product.variant.units_per_pack,
      physical_units: physicalUnitsRequired,
      original_price_cents: product.variant.price_cents,
      offer_price_cents: product.variant.offer_price_cents,
      offer_active: product.variant.offer_active,
      effective_price_cents: effectivePriceCents,
      discount_cents: product.variant.discount_cents,
      commercial_variant_id: product.variant.id,
      inventory_variant_id: product.variant.inventory_variant_id,
    },
  });

  if (itemError) {
    return dbError("order_item_create_failed", itemError.message);
  }

  if (summerDrop) {
    const { data: claimed, error: claimError } = await supabase.rpc("claim_summer_drop_allocation", {
      p_order_id: order.id,
      p_packs: payload.quantity,
    });
    if (claimError || claimed !== true) {
      await supabase.from("orders").update({
        status: "cancelled",
        payment_status: "failed",
        cancelled_at: new Date().toISOString(),
      }).eq("id", order.id);
      return {
        ok: false,
        status: 409,
        error: "summer_drop_unavailable",
        detail: "Summer Drop agotado por el momento. Elige otro pack disponible.",
      };
    }
  }
  const releaseSummerDropClaim = async () => {
    if (!summerDrop) return;
    await supabase.from("orders").update({
      status: "cancelled",
      payment_status: "failed",
      cancelled_at: new Date().toISOString(),
    }).eq("id", order.id);
  };

  await persistOrderAttribution({
    attribution: attributionSnapshot,
    orderId: order.id,
    supabase,
  });

  const paymentResult = await createPaymentAttempt({
    amountCents: totalCents,
    currency: product.variant.currency,
    idempotencyKey: `payment:${payload.idempotency_key}`,
    orderId: order.id,
    paymentProvider,
    supabase,
  });

  if (!paymentResult.ok) {
    await releaseSummerDropClaim();
    return paymentResult.result;
  }

  const payment = paymentResult.payment;

  if (paymentProvider === "mercadopago") {
    const providerCheckoutUrl = `${appUrl}/checkout/payment?checkout_session=${checkoutReservation.id}`;
    const { data: checkoutSession, error: checkoutError } = await supabase
      .from("checkout_sessions")
      .update({
        customer_id: customer.id,
        order_id: order.id,
        provider: "mercadopago",
        status: "payment_started",
        email: payload.email,
        phone: payload.phone,
        idempotency_key: payload.idempotency_key,
        metadata: {
          variant_id: product.variant.id,
          quantity: payload.quantity,
          units_per_pack: product.variant.units_per_pack,
          physical_units: physicalUnitsRequired,
          inventory_variant_id: product.variant.inventory_variant_id,
          payment_id: payment.id,
          attempt_signature: attemptSignature,
          attribution: attributionSnapshot,
        },
      })
      .eq("id", checkoutReservation.id)
      .select("id")
      .single();

  if (checkoutError || !checkoutSession) {
      await releaseSummerDropClaim();
      return dbError("checkout_session_create_failed", checkoutError?.message);
    }

    const { error: checkoutUrlError } = await supabase
      .from("checkout_sessions")
      .update({ provider_checkout_url: providerCheckoutUrl })
      .eq("id", checkoutReservation.id);

    if (checkoutUrlError) {
      await releaseSummerDropClaim();
      return dbError("checkout_session_create_failed", checkoutUrlError.message);
    }

    return { ok: true, url: providerCheckoutUrl };
  }

  if (!stripe) {
    await releaseSummerDropClaim();
    return {
      ok: false,
      status: 501,
      error: "stripe_not_configured",
      detail: "Stripe rollback provider is not configured.",
    };
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: payload.email,
      client_reference_id: order.id,
      line_items: [
        {
          price_data: {
            currency: product.variant.currency,
            product_data: {
              name: product.name,
              description: discountCents ? `${product.variant.name} × ${payload.quantity}` : product.variant.name,
              metadata: {
                product_id: product.id,
                variant_id: product.variant.id,
                sku: product.variant.sku,
                units_per_pack: String(product.variant.units_per_pack),
                physical_units: String(physicalUnitsRequired),
              },
            },
                unit_amount: discountCents ? subtotalCents - discountCents : effectivePriceCents,
          },
          quantity: discountCents ? 1 : payload.quantity,
        },
        ...(shippingCents > 0
          ? [
              {
                price_data: {
                  currency: product.variant.currency,
                  product_data: { name: "Envio" },
                  unit_amount: shippingCents,
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        payment_id: payment.id,
        idempotency_key: payload.idempotency_key,
        attribution_source: attributionSnapshot.last_touch_source,
        attribution_campaign: attributionSnapshot.last_touch_campaign,
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          payment_id: payment.id,
          idempotency_key: payload.idempotency_key,
          attribution_source: attributionSnapshot.last_touch_source,
          attribution_campaign: attributionSnapshot.last_touch_campaign,
        },
      },
      phone_number_collection: { enabled: true },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout?variant=${product.variant.id}`,
    },
    { idempotencyKey: payload.idempotency_key },
  );

  if (!session.url) {
    await releaseSummerDropClaim();
    return {
      ok: false,
      status: 502,
      error: "stripe_session_missing_url",
      detail: "Stripe created a session without a redirect URL.",
    };
  }

  const stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  await Promise.all([
    supabase
      .from("orders")
      .update({
        payment_provider: "stripe",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: stripePaymentIntentId,
      })
      .eq("id", order.id),
    supabase
      .from("payments")
      .update({
        provider: "stripe",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: stripePaymentIntentId,
      })
      .eq("id", payment.id),
    supabase.from("checkout_sessions").update({
      customer_id: customer.id,
      order_id: order.id,
      provider: "stripe",
      status: "payment_started",
      email: payload.email,
      phone: payload.phone,
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
      stripe_payment_intent_id: stripePaymentIntentId,
      idempotency_key: payload.idempotency_key,
      metadata: {
        variant_id: product.variant.id,
        quantity: payload.quantity,
        units_per_pack: product.variant.units_per_pack,
        physical_units: physicalUnitsRequired,
        inventory_variant_id: product.variant.inventory_variant_id,
        payment_id: payment.id,
        attempt_signature: attemptSignature,
        attribution: attributionSnapshot,
      },
      expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    }).eq("id", checkoutReservation.id),
  ]);

  return { ok: true, url: session.url };
}

async function reserveCheckoutAttempt({
  appUrl,
  attemptSignature,
  payload,
  paymentProvider,
  supabase,
}: {
  appUrl: string;
  attemptSignature: string;
  payload: CheckoutInput;
  paymentProvider: string;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}): Promise<
  | { ok: true; checkoutSession: CheckoutSessionRow; result?: never }
  | { ok: true; checkoutSession?: never; result: CheckoutResult }
  | { ok: false; checkoutSession?: never; result: CheckoutResult }
> {
  const existingAttempt = await findCheckoutAttempt(supabase, payload.idempotency_key);

  if (existingAttempt) {
    return handleExistingCheckoutAttempt({
      appUrl,
      attemptSignature,
      idempotencyKey: payload.idempotency_key,
      paymentProvider,
      supabase,
      checkoutSession: existingAttempt,
    });
  }

  const { data: checkoutSession, error } = await supabase
    .from("checkout_sessions")
    .insert({
      provider: paymentProvider,
      status: "started",
      email: payload.email,
      phone: payload.phone,
      idempotency_key: payload.idempotency_key,
      metadata: {
        attempt_signature: attemptSignature,
        variant_id: payload.product_variant_id,
        quantity: payload.quantity,
        attribution: toOrderAttributionSnapshot(parseAttributionPayload(payload.attribution)),
      },
    })
    .select("id, order_id, provider, provider_checkout_url, stripe_checkout_url, metadata")
    .single();

  if (error || !checkoutSession) {
    if (error?.code === "23505") {
      const duplicateAttempt = await findCheckoutAttempt(
        supabase,
        payload.idempotency_key,
      );

      if (duplicateAttempt) {
        return handleExistingCheckoutAttempt({
          appUrl,
          attemptSignature,
          idempotencyKey: payload.idempotency_key,
          paymentProvider,
          supabase,
          checkoutSession: duplicateAttempt,
        });
      }
    }

    return {
      ok: false,
      result: dbError("checkout_attempt_reservation_failed", error?.message),
    };
  }

  return { ok: true, checkoutSession: checkoutSession as CheckoutSessionRow };
}

async function persistOrderAttribution({
  attribution,
  orderId,
  supabase,
}: {
  attribution: AttributionOrderSnapshot;
  orderId: string;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}) {
  const { error } = await supabase.from("order_attribution").upsert(
    {
      order_id: orderId,
      ...attribution,
    },
    { onConflict: "order_id" },
  );

  if (error) {
    console.error("Order attribution persistence failed", {
      order_id: orderId,
      code: error.code,
      message: error.message,
    });
  }
}

async function handleExistingCheckoutAttempt({
  appUrl,
  attemptSignature,
  checkoutSession,
  idempotencyKey,
  paymentProvider,
  supabase,
}: {
  appUrl: string;
  attemptSignature: string;
  checkoutSession: CheckoutSessionRow;
  idempotencyKey: string;
  paymentProvider: string;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}): Promise<
  { ok: true; result: CheckoutResult } | { ok: false; result: CheckoutResult }
> {
  if (checkoutSession.provider !== paymentProvider) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 409,
        error: "idempotency_key_provider_mismatch",
        detail: "This checkout attempt key belongs to a different payment provider.",
      },
    };
  }

  if (!isSameAttemptSignature(checkoutSession.metadata, attemptSignature)) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 409,
        error: "idempotency_key_payload_mismatch",
        detail: "This checkout attempt key was reused with different checkout data.",
      },
    };
  }

  const existingUrl = checkoutUrlForProvider({
    appUrl,
    checkoutSession,
    paymentProvider,
  });

  if (existingUrl) {
    return { ok: true, result: { ok: true, url: existingUrl } };
  }

  const readyAttempt = await waitForCheckoutAttempt({
    appUrl,
    idempotencyKey,
    paymentProvider,
    supabase,
    fallbackId: checkoutSession.id,
  });

  if (readyAttempt) {
    return { ok: true, result: { ok: true, url: readyAttempt } };
  }

  return {
    ok: false,
    result: {
      ok: false,
      status: 409,
      error: "checkout_attempt_in_progress",
      detail: "This checkout attempt is already being created. Retry the same request shortly.",
    },
  };
}

async function waitForCheckoutAttempt({
  appUrl,
  fallbackId,
  idempotencyKey,
  paymentProvider,
  supabase,
}: {
  appUrl: string;
  fallbackId: string;
  idempotencyKey: string;
  paymentProvider: string;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}) {
  const delays = [80, 140, 220, 360, 560];

  for (const delay of delays) {
    await sleep(delay);

    const checkoutSession = idempotencyKey
      ? await findCheckoutAttempt(supabase, idempotencyKey)
      : await findCheckoutAttemptById(supabase, fallbackId);
    const url = checkoutSession
      ? checkoutUrlForProvider({ appUrl, checkoutSession, paymentProvider })
      : null;

    if (url) {
      return url;
    }
  }

  return null;
}

function checkoutUrlForProvider({
  appUrl,
  checkoutSession,
  paymentProvider,
}: {
  appUrl: string;
  checkoutSession: CheckoutSessionRow;
  paymentProvider: string;
}) {
  if (paymentProvider === "mercadopago") {
    return (
      checkoutSession.provider_checkout_url ||
      (checkoutSession.order_id
        ? `${appUrl}/checkout/payment?checkout_session=${checkoutSession.id}`
        : null)
    );
  }

  return checkoutSession.stripe_checkout_url || null;
}

async function findCheckoutAttempt(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  idempotencyKey: string,
) {
  const { data } = await supabase
    .from("checkout_sessions")
    .select("id, order_id, provider, provider_checkout_url, stripe_checkout_url, metadata")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  return (data || null) as CheckoutSessionRow | null;
}

async function findCheckoutAttemptById(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  checkoutSessionId: string,
) {
  const { data } = await supabase
    .from("checkout_sessions")
    .select("id, order_id, provider, provider_checkout_url, stripe_checkout_url, metadata")
    .eq("id", checkoutSessionId)
    .maybeSingle();

  return (data || null) as CheckoutSessionRow | null;
}

export async function createPaymentAttempt({
  amountCents,
  currency,
  idempotencyKey,
  orderId,
  paymentProvider,
  supabase,
}: {
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  orderId: string;
  paymentProvider: string;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}): Promise<
  | { ok: true; payment: PaymentRow; result?: never }
  | { ok: false; payment?: never; result: CheckoutResult }
> {
  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      order_id: orderId,
      provider: paymentProvider,
      status: "requires_payment",
      amount_cents: amountCents,
      currency,
      idempotency_key: idempotencyKey,
    })
    .select("id, order_id, provider, status, amount_cents, currency, idempotency_key")
    .single();

  if (!error && payment) {
    return { ok: true, payment: payment as PaymentRow };
  }

  if (error?.code !== "23505") {
    return {
      ok: false,
      result: dbError("payment_create_failed", error?.message),
    };
  }

  const { data: existingPayment, error: existingError } = await supabase
    .from("payments")
    .select("id, order_id, provider, status, amount_cents, currency, idempotency_key")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingError || !existingPayment) {
    return {
      ok: false,
      result: dbError("payment_idempotency_lookup_failed", existingError?.message),
    };
  }

  const typedPayment = existingPayment as PaymentRow;

  if (
    typedPayment.order_id !== orderId ||
    typedPayment.provider !== paymentProvider ||
    Number(typedPayment.amount_cents) !== amountCents ||
    typedPayment.currency !== currency
  ) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 409,
        error: "payment_idempotency_collision",
        detail: "Payment idempotency key belongs to a different logical operation.",
      },
    };
  }

  return { ok: true, payment: typedPayment };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getShippingCents(freeShipping: boolean) {
  if (freeShipping) {
    return 0;
  }

  const policy = await getShippingPolicy();

  return policy.freeShippingEnabled ? 0 : policy.shippingFeeCents;
}

function dbError(error: string, detail = "Database operation failed."): CheckoutResult {
  return {
    ok: false,
    status: 500,
    error,
    detail,
  };
}

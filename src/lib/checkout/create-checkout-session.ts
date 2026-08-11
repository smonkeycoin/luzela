import { z } from "zod";

import { getCheckoutProduct } from "@/lib/catalog/get-checkout-product";
import { getAppUrl } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
});

type CheckoutInput = z.infer<typeof checkoutInputSchema>;

type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; detail: string };

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

  const { data: existingCheckout } = await supabase
    .from("checkout_sessions")
    .select("provider, provider_checkout_url, stripe_checkout_url")
    .eq("idempotency_key", payload.idempotency_key)
    .maybeSingle();

  if (
    paymentProvider === "mercadopago" &&
    existingCheckout?.provider === "mercadopago" &&
    existingCheckout?.provider_checkout_url
  ) {
    return { ok: true, url: existingCheckout.provider_checkout_url as string };
  }

  if (paymentProvider === "stripe" && existingCheckout?.stripe_checkout_url) {
    return { ok: true, url: existingCheckout.stripe_checkout_url as string };
  }

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

  const shippingCents = await getShippingCents(product.free_shipping);
  const subtotalCents = product.variant.price_cents * payload.quantity;
  const discountCents = 0;
  const taxCents = 0;
  const totalCents = subtotalCents - discountCents + shippingCents + taxCents;
  const appUrl = getAppUrl();

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
      discount_cents: discountCents,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      metadata: {
        checkout_idempotency_key: payload.idempotency_key,
        product_slug: product.slug,
        pack_quantity: payload.quantity,
        units_per_pack: product.variant.units_per_pack,
        physical_units: physicalUnitsRequired,
      },
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
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
    unit_price_cents: product.variant.price_cents,
    subtotal_cents: subtotalCents,
    metadata: {
      analytics_item_id: product.variant.analytics_item_id,
      pack_quantity: payload.quantity,
      units_per_pack: product.variant.units_per_pack,
      physical_units: physicalUnitsRequired,
      commercial_variant_id: product.variant.id,
      inventory_variant_id: product.variant.inventory_variant_id,
    },
  });

  if (itemError) {
    return dbError("order_item_create_failed", itemError.message);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: order.id,
      provider: paymentProvider,
      status: "requires_payment",
      amount_cents: totalCents,
      currency: product.variant.currency,
      idempotency_key: `payment:${payload.idempotency_key}`,
    })
    .select("id")
    .single();

  if (paymentError || !payment) {
    return dbError("payment_create_failed", paymentError?.message);
  }

  if (paymentProvider === "mercadopago") {
    const { data: checkoutSession, error: checkoutError } = await supabase
      .from("checkout_sessions")
      .insert({
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
        },
      })
      .select("id")
      .single();

    if (checkoutError || !checkoutSession) {
      return dbError("checkout_session_create_failed", checkoutError?.message);
    }

    const providerCheckoutUrl = `${appUrl}/checkout/payment?checkout_session=${checkoutSession.id}`;

    await supabase
      .from("checkout_sessions")
      .update({ provider_checkout_url: providerCheckoutUrl })
      .eq("id", checkoutSession.id);

    return { ok: true, url: providerCheckoutUrl };
  }

  if (!stripe) {
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
              description: product.variant.name,
              metadata: {
                product_id: product.id,
                variant_id: product.variant.id,
                sku: product.variant.sku,
                units_per_pack: String(product.variant.units_per_pack),
                physical_units: String(physicalUnitsRequired),
              },
            },
            unit_amount: product.variant.price_cents,
          },
          quantity: payload.quantity,
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
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          payment_id: payment.id,
          idempotency_key: payload.idempotency_key,
        },
      },
      phone_number_collection: { enabled: true },
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout?variant=${product.variant.id}`,
    },
    { idempotencyKey: payload.idempotency_key },
  );

  if (!session.url) {
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
    supabase.from("checkout_sessions").insert({
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
      },
      expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : null,
    }),
  ]);

  return { ok: true, url: session.url };
}

async function getShippingCents(freeShipping: boolean) {
  if (freeShipping) {
    return 0;
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return 0;
  }

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shipping.flat_rate_cents")
    .maybeSingle();

  return Number(data?.value ?? 0);
}

function dbError(error: string, detail = "Database operation failed."): CheckoutResult {
  return {
    ok: false,
    status: 500,
    error,
    detail,
  };
}

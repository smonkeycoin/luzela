import { NextResponse } from "next/server";
import { z } from "zod";

import { createCheckoutSession } from "@/lib/checkout/create-checkout-session";
import { recordCommerceEvent, safeOrderAttribution } from "@/lib/analytics/commerce";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const checkoutRequestSchema = z.object({
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
  quantity: z.coerce.number().int().positive().max(10).default(1),
  coupon_code: z.string().trim().max(64).optional(),
  idempotency_key: z.uuid(),
  attribution: z.string().trim().max(8000).optional(),
  analytics_session_id: z.uuid().optional(),
  analytics_is_qa: z.enum(["true", "false"]).optional(),
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const values = { country: "MX", ...Object.fromEntries(formData) };
  const parsed = checkoutRequestSchema.safeParse(values);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_checkout_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createCheckoutSession(parsed.data);
  const isQa = parsed.data.analytics_is_qa === "true" || /playwright|headlesschrome|puppeteer/i.test(request.headers.get("user-agent") || "");

  if (!result.ok) {
    if (result.status >= 500) {
      console.error("Checkout failed", {
        error: result.error,
        status: result.status,
      });

      return NextResponse.json(
        { ok: false, error: "payment_temporarily_unavailable" },
        { status: result.status },
      );
    }

    return NextResponse.json(result, { status: result.status });
  }

  // The checkout helper has finished creating the internal order and session.
  // This lookup uses its trusted URL; clients cannot submit authoritative events.
  try {
    const sessionId = new URL(result.url).searchParams.get("checkout_session");
    const db = createSupabaseAdminClient();
    if (sessionId && db) {
      const { data: session } = await db.from("checkout_sessions")
        .select("id, order_id, metadata").eq("id", sessionId).maybeSingle();
      if (session?.order_id) {
        const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata as Record<string, unknown> : {};
        const anonymousId = parsed.data.analytics_session_id || null;
        await db.from("checkout_sessions").update({ metadata: {
          ...metadata, analytics_session_id: anonymousId,
          analytics_is_qa: isQa,
        } }).eq("id", session.id);
        const { data: attribution } = await db.from("order_attribution")
          .select("first_touch_source,first_touch_medium,first_touch_campaign,first_touch_content,last_touch_source,last_touch_medium,last_touch_campaign,last_touch_content")
          .eq("order_id", session.order_id).maybeSingle();
        const { data: item } = await db.from("order_items").select("product_id, sku, quantity, subtotal_cents")
          .eq("order_id", session.order_id).limit(1).maybeSingle();
        const { data: order } = await db.from("orders").select("discount_code, metadata")
          .eq("id", session.order_id).maybeSingle();
        const orderMetadata = order?.metadata && typeof order.metadata === "object" ? order.metadata as Record<string, unknown> : {};
        await recordCommerceEvent({ event_name: "checkout_created", event_key: `checkout_created:${session.id}`,
          anonymous_session_id: anonymousId, checkout_session_id: session.id, order_id: session.order_id,
          product_id: item?.product_id || null, product_sku: item?.sku || null,
          quantity: item?.quantity || null, value_cents: item?.subtotal_cents || null,
          is_qa: isQa, ...safeOrderAttribution(attribution as Record<string, unknown> | null),
          ...(orderMetadata.campaign === "summer_drop" ? { campaign: "summer_drop", ref: "summerdrop" } : {}),
          metadata: { coupon: order?.discount_code || null, attribution_reason: typeof orderMetadata.collab_attribution_reason === "string" ? orderMetadata.collab_attribution_reason.slice(0, 40) : null,
            ...(orderMetadata.collab_attribution ? { collab_attribution: orderMetadata.collab_attribution } : {}) } });
      }
    }
  } catch { console.warn("commerce_analytics_write_failed", { event: "checkout_created" }); }

  if(request.headers.get("accept")?.includes("application/json"))return NextResponse.json(result);
  return NextResponse.redirect(result.url, { status: 303 });
}

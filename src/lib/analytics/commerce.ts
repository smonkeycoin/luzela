import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const CLIENT_EVENTS = [
  "session_started", "view_home", "view_shop", "view_campaign", "view_product",
  "add_to_cart", "view_cart", "begin_checkout", "payment_page_viewed", "payment_submitted",
] as const;

export type CommerceEventName = typeof CLIENT_EVENTS[number] |
  "checkout_created" | "payment_provider_accepted" | "payment_provider_rejected" | "purchase";

export type CommerceEvent = {
  event_name: CommerceEventName;
  event_key?: string;
  anonymous_session_id?: string | null;
  order_id?: string | null;
  checkout_session_id?: string | null;
  product_id?: string | null;
  product_sku?: string | null;
  quantity?: number | null;
  value_cents?: number | null;
  currency?: string;
  first_source?: string | null;
  first_medium?: string | null;
  first_campaign?: string | null;
  first_content?: string | null;
  first_ref?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  ref?: string | null;
  referrer_domain?: string | null;
  landing_path?: string | null;
  is_qa?: boolean;
  metadata?: Record<string, unknown>;
};

export function analyticsEnvironment(): "production" | "preview" | "development" {
  return process.env.VERCEL_ENV === "production" ? "production"
    : process.env.VERCEL_ENV === "preview" ? "preview" : "development";
}

export async function recordCommerceEvent(event: CommerceEvent): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    if (!db) throw new Error("backend_unavailable");
    const row = { ...event, environment: analyticsEnvironment() };
    const { error } = event.event_key
      ? await db.from("commerce_events").upsert(row, { onConflict: "event_key", ignoreDuplicates: true })
      : await db.from("commerce_events").insert(row);
    if (error) throw error;
  } catch {
    // Analytics must never change the outcome of a cart, payment, email, or order.
    console.warn("commerce_analytics_write_failed", { event: event.event_name });
  }
}

export function safeOrderAttribution(row: Record<string, unknown> | null | undefined) {
  if (!row) return {};
  const take = (key: string) => typeof row[key] === "string" ? String(row[key]).slice(0, 160) : null;
  return {
    first_source: take("first_touch_source"), first_medium: take("first_touch_medium"),
    first_campaign: take("first_touch_campaign"), first_content: take("first_touch_content"),
    source: take("last_touch_source"), medium: take("last_touch_medium"),
    campaign: take("last_touch_campaign"), content: take("last_touch_content"),
  };
}

export async function orderEventContext(orderId: string) {
  const db = createSupabaseAdminClient();
  if (!db) return { anonymous_session_id: null, checkout_session_id: null, is_qa: false, attribution: {} };
  const [{ data: session }, { data: attribution }] = await Promise.all([
    db.from("checkout_sessions").select("id, metadata").eq("order_id", orderId).maybeSingle(),
    db.from("order_attribution").select("first_touch_source,first_touch_medium,first_touch_campaign,first_touch_content,last_touch_source,last_touch_medium,last_touch_campaign,last_touch_content").eq("order_id", orderId).maybeSingle(),
  ]);
  const metadata = session?.metadata && typeof session.metadata === "object" ? session.metadata as Record<string, unknown> : {};
  const candidate = metadata.analytics_session_id;
  return {
    anonymous_session_id: typeof candidate === "string" && /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null,
    checkout_session_id: session?.id || null,
    is_qa: metadata.analytics_is_qa === true,
    attribution: safeOrderAttribution(attribution as Record<string, unknown> | null),
  };
}

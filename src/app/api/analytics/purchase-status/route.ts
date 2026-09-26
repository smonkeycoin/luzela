import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.strictObject({ checkout_session_id: z.uuid(), anonymous_session_id: z.uuid() });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return new Response(null, { status: 403 });
  const body = await request.text();
  if (body.length > 256) return new Response(null, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return new Response(null, { status: 400 });
  const db = createSupabaseAdminClient();
  if (!db) return new Response(null, { status: 503 });
  const { data: session } = await db.from("checkout_sessions").select("order_id, metadata")
    .eq("id", parsed.data.checkout_session_id).maybeSingle();
  const metadata = session?.metadata && typeof session.metadata === "object" ? session.metadata as Record<string, unknown> : {};
  if (!session?.order_id || metadata.analytics_session_id !== parsed.data.anonymous_session_id) return new Response(null, { status: 404 });
  const { data: order } = await db.from("orders").select("id, payment_status, subtotal_cents, discount_cents, currency")
    .eq("id", session.order_id).maybeSingle();
  if (!order) return new Response(null, { status: 404 });
  return Response.json({ paid: order.payment_status === "paid",
    ...(order.payment_status === "paid" ? {
      event_id: `purchase:${order.id}`,
      value: Math.max(0, order.subtotal_cents - order.discount_cents) / 100,
      currency: order.currency.toUpperCase(),
    } : {}) }, { headers: { "Cache-Control": "no-store" } });
}

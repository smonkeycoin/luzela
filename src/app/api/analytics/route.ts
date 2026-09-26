import { z } from "zod";
import { CLIENT_EVENTS, recordCommerceEvent } from "@/lib/analytics/commerce";

const short = z.string().trim().max(160).regex(/^[a-z0-9_.-]*$/i).optional();
const schema = z.strictObject({
  event_name: z.enum(CLIENT_EVENTS),
  anonymous_session_id: z.uuid(),
  event_key: z.string().max(180).regex(/^[a-z0-9:_-]+$/i).optional(),
  product_id: z.uuid().optional(),
  product_sku: z.string().max(80).regex(/^[a-z0-9_-]*$/i).optional(),
  quantity: z.number().int().positive().max(100).optional(),
  value_cents: z.number().int().nonnegative().max(10_000_000).optional(),
  currency: z.literal("mxn").optional(),
  first_source: short, first_medium: short, first_campaign: short, first_content: short, first_ref: short,
  source: short, medium: short, campaign: short, content: short, ref: short,
  referrer_domain: z.string().max(160).regex(/^[a-z0-9.-]*$/i).optional(),
  landing_path: z.enum(["/", "/cart", "/checkout", "/checkout/payment", "/checkout/success", "/chavolines", "/other"]).optional(),
  is_qa: z.boolean().optional(),
  metadata: z.strictObject({ item_count: z.number().int().min(0).max(100).optional() }).optional(),
});

const requests = new Map<string, { count: number; until: number }>();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 2048) return new Response(null, { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { return new Response(null, { status: 400 }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return new Response(null, { status: 400 });
  const id = parsed.data.anonymous_session_id;
  const now = Date.now();
  const limit = requests.get(id);
  if (limit && limit.until > now && limit.count >= 120) return new Response(null, { status: 429 });
  if (requests.size > 20_000) requests.clear();
  requests.set(id, { count: limit && limit.until > now ? limit.count + 1 : 1, until: limit && limit.until > now ? limit.until : now + 60_000 });
  const isBot = /playwright|headlesschrome|puppeteer/i.test(request.headers.get("user-agent") || "");
  await recordCommerceEvent({ ...parsed.data,
    event_key: parsed.data.event_key ? `client:${parsed.data.event_key}` : undefined,
    is_qa: parsed.data.is_qa === true || isBot });
  return new Response(null, { status: 204 });
}

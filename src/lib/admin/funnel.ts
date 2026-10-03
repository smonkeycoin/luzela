import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Row = {
  event_name: string; anonymous_session_id: string | null; order_id: string | null;
  product_sku: string | null; quantity: number | null; value_cents: number | null;
  source: string | null; campaign: string | null; ref: string | null;
  metadata: Record<string, unknown> | null;
};

export const FUNNEL_STEPS = [
  ["session_started", "Sesiones"], ["view_product", "Interés en producto"],
  ["add_to_cart", "Añadir al carrito"], ["begin_checkout", "Checkout"],
  ["payment_submitted", "Pago enviado"], ["purchase", "Compras"],
] as const;

function group(row: Row) {
  if (row.ref === "chavolines" || row.campaign === "luzela_x_chavolines" || String(row.metadata?.coupon || "").toUpperCase() === "CHAVOLIN10") return "Chavolines";
  const source = (row.source || "unknown").toLowerCase();
  if (source.includes("instagram") || source === "elmundoenpareja") return "Instagram";
  if (source.includes("google")) return "Google";
  if (source.includes("facebook") || source === "meta") return "Facebook";
  if (source === "direct") return "Directo";
  return "Otro / desconocido";
}

export async function getFunnel(range: "today" | "7d" | "30d") {
  const db = createSupabaseAdminClient();
  const { data: setting } = db ? await db.from("commerce_measurement_settings")
    .select("value").eq("key", "FUNNEL_MEASUREMENT_START").maybeSingle() : { data: null };
  const startString = setting?.value || process.env.FUNNEL_MEASUREMENT_START || "";
  const startMs = Date.parse(startString);
  const measurementStart = Number.isFinite(startMs) ? new Date(startMs).toISOString() : null;
  if (!db || !measurementStart) return { measurementStart, error: !db ? "Supabase no está configurado." : null, rows: [] as Row[] };
  const now = new Date();
  const cancunDate = now.toLocaleDateString("en-CA", { timeZone: "America/Cancun" });
  const rangeStart = range === "today" ? new Date(`${cancunDate}T05:00:00Z`)
    : new Date(now.getTime() - (range === "7d" ? 7 : 30) * 86400_000);
  const from = new Date(Math.max(rangeStart.getTime(), startMs)).toISOString();
  const rows: Row[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const { data, error } = await db.from("commerce_events")
      .select("event_name,anonymous_session_id,order_id,product_sku,quantity,value_cents,source,campaign,ref,metadata")
      .eq("is_qa", false).eq("environment", "production").gte("occurred_at", from)
      .order("occurred_at", { ascending: true }).range(offset, offset + 999);
    if (error) return { measurementStart, error: "No se pudieron cargar los eventos.", rows: [] as Row[] };
    rows.push(...((data || []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return rows.length >= 100_000
    ? { measurementStart, error: "Demasiados eventos para esta vista; reduzca el período.", rows: [] as Row[] }
    : { measurementStart, error: null, rows };
}

export async function getSummerDropPaidSummary() {
  const db = createSupabaseAdminClient();
  if (!db) return { paid_packs: 0, physical_units: 0, gross_cents: 0, discount_cents: 0, net_cents: 0, error: "Supabase no está configurado." };
  const { data, error } = await db.from("orders")
    .select("subtotal_cents, discount_cents, metadata, order_items(physical_units)")
    .eq("payment_status", "paid")
    .contains("metadata", { campaign: "summer_drop" });
  if (error) return { paid_packs: 0, physical_units: 0, gross_cents: 0, discount_cents: 0, net_cents: 0, error: "No se pudieron cargar las órdenes Summer Drop." };
  const rows = data || [];
  const paid_packs = rows.reduce((total, row) => {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    const promotion = metadata.promotion && typeof metadata.promotion === "object" ? metadata.promotion as Record<string, unknown> : {};
    return total + Number(promotion.pack_quantity || 1);
  }, 0);
  const physical_units = rows.reduce((total, row) => total + (row.order_items || []).reduce((sum, item) => sum + Number(item.physical_units || 0), 0), 0);
  const gross_cents = rows.reduce((total, row) => total + Number(row.subtotal_cents || 0), 0);
  const discount_cents = rows.reduce((total, row) => total + Number(row.discount_cents || 0), 0);
  return { paid_packs, physical_units, gross_cents, discount_cents, net_cents: gross_cents - discount_cents, error: null };
}

export function summarizeFunnel(rows: Row[]) {
  const distinct = (events: Row[], type: string) => new Set(events.filter((row) => row.event_name === type)
    .map((row) => row.anonymous_session_id || row.order_id).filter(Boolean)).size;
  const steps = FUNNEL_STEPS.map(([name, label]) => ({ name, label, count: distinct(rows, name) }));
  const sourceGroups = ["Instagram", "Chavolines", "Directo", "Google", "Facebook", "Otro / desconocido"];
  const sources = sourceGroups.map((name) => {
    const events = rows.filter((row) => group(row) === name);
    return { name, sessions: distinct(events, "session_started"), atc: distinct(events, "add_to_cart"),
      checkout: distinct(events, "begin_checkout"), purchases: distinct(events, "purchase"),
      netCents: events.filter((row) => row.event_name === "purchase").reduce((n, row) => n + (row.value_cents || 0), 0) };
  }).filter((source) => source.sessions || source.atc || source.checkout || source.purchases);
  const products = ["SUMMER 1X", "SUMMER 2X", "SUMMER 3X"].map((label, i) => {
    const suffix = `${i + 1}x`;
    const events = rows.filter((row) => row.product_sku?.toLowerCase().includes(suffix));
    const buys = events.filter((row) => row.event_name === "purchase");
    return { label, views: distinct(events, "view_product"), atc: distinct(events, "add_to_cart"),
      checkouts: distinct(events, "checkout_created"), purchases: buys.length,
      units: buys.reduce((n, row) => {
        const items = Array.isArray(row.metadata?.items) ? row.metadata.items as Array<{ units?: number }> : [];
        return n + items.reduce((total, item) => total + (Number(item.units) || 0), 0);
      }, 0), netCents: buys.reduce((n, row) => n + (row.value_cents || 0), 0) };
  });
  const campaignRows = rows.filter((row) => row.campaign === "summer_drop" || row.product_sku === "LUZ-SUMMER-3X");
  const campaignCount = (name: string) => distinct(campaignRows, name);
  const summerDrop = {
    sessions: campaignCount("session_started"),
    views: campaignCount("view_product"),
    addToCart: campaignCount("add_to_cart"),
    checkouts: campaignCount("checkout_created"),
    paymentViews: campaignCount("payment_page_viewed"),
    paymentSubmissions: campaignCount("payment_submitted"),
    purchases: campaignCount("purchase"),
    netCents: campaignRows.filter((row) => row.event_name === "purchase").reduce((n, row) => n + (row.value_cents || 0), 0),
  };
  return { steps, sources, products, summerDrop };
}

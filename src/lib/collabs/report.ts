import { createSupabaseServerClient } from "@/lib/supabase/server";
export type SafeSale = {
  date: string;
  order_number: string;
  product: string;
  units: number;
  gross_merchandise: number;
  discount: number;
  net_merchandise: number;
  shipping: number;
  total: number;
  status: string;
  fulfillment_status: string;
  source: string;
};
export type CollabReport = {
  orders: number;
  gross_merchandise: number;
  discount: number;
  net_merchandise: number;
  shipping: number;
  total: number;
  units: number;
  aov: number;
  rows: SafeSale[];
  sources: { source: string; orders: number; net_merchandise: number }[];
  products: { product: string; units: number; net_merchandise: number }[];
};
export type ReportParams = {
  range?: string;
  from?: string;
  to?: string;
  page?: string;
  collaborator?: string;
};
export function reportRange(params: ReportParams, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cancun",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const range = ["today", "7d", "30d", "90d", "custom"].includes(
    params.range || "",
  )
    ? params.range!
    : "30d";
  let start = new Date(`${today}T00:00:00-05:00`);
  let end = new Date(start.getTime() + 86400000);
  if (range === "custom") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(params.from || "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(params.to || "")
    )
      throw new Error("Selecciona ambas fechas.");
    start = new Date(`${params.from}T00:00:00-05:00`);
    end = new Date(
      new Date(`${params.to}T00:00:00-05:00`).getTime() + 86400000,
    );
  } else
    start = new Date(
      start.getTime() -
        (range === "today" ? 0 : parseInt(range) - 1) * 86400000,
    );
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  )
    throw new Error("Revisa el intervalo de fechas.");
  return { since_at: start.toISOString(), until_at: end.toISOString(), range };
}
export async function getCollabReport(
  target: string,
  params: ReportParams,
  offset?: number,
  size = 100,
): Promise<CollabReport> {
  const db = await createSupabaseServerClient();
  if (!db) throw new Error("Sesión no disponible.");
  const { since_at, until_at } = reportRange(params);
  const page = Math.max(1, Math.min(100000, parseInt(params.page || "1") || 1));
  const { data, error } = await db.rpc("collab_report", {
    target,
    since_at,
    until_at,
    page_offset: offset ?? (page - 1) * size,
    page_size: size,
  });
  if (error)
    throw new Error("No pudimos cargar el reporte. Inténtalo de nuevo.");
  return data as CollabReport;
}
export function salesCsv(rows: SafeSale[]) {
  const escape = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const fields = [
    "date",
    "order_number",
    "product",
    "units",
    "gross_merchandise",
    "discount",
    "net_merchandise",
    "status",
    "attribution_source",
  ] as const;
  return (
    fields.join(",") +
    "\r\n" +
    rows
      .map((row) =>
        fields
          .map((field) =>
            escape(
              field === "attribution_source"
                ? row.source
                : ["gross_merchandise", "discount", "net_merchandise"].includes(field)
                  ? (Number(row[field as keyof SafeSale]) / 100).toFixed(2)
                  : row[field as keyof SafeSale],
            ),
          )
          .join(","),
      )
      .join("\r\n")
  );
}

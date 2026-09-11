import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCollabReport, salesCsv, type SafeSale } from "@/lib/collabs/report";
export async function GET(request: Request) {
  const db = await createSupabaseServerClient();
  if (!db) return new Response("Unauthorized", { status: 401 });
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const target = url.searchParams.get("collaborator");
  if (!target || !/^[0-9a-f-]{36}$/.test(target))
    return new Response("Invalid collaboration", { status: 400 });
  const { data: collab } = await db
    .from("collaborators")
    .select("id,slug")
    .eq("id", target)
    .maybeSingle();
  if (!collab) return new Response("Forbidden", { status: 403 });
  const params = Object.fromEntries(url.searchParams);
  const rows: SafeSale[] = [];
  try {
    for (let offset = 0; ; offset += 500) {
      const report = await getCollabReport(target, params, offset, 500);
      rows.push(...report.rows);
      if (offset + 500 >= report.orders) break;
    }
  } catch {
    return new Response(
      "Reporte no disponible. Revisa las fechas y tu acceso.",
      { status: 400 },
    );
  }
  return new Response("\ufeff" + salesCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="luzela-${String(collab.slug).replace(/[^a-z0-9-]/g, "")}-sales-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

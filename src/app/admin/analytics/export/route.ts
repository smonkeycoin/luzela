import { requireAdminSession } from "@/lib/auth/admin";
import { getAnalyticsCsv, getAttributionCsv } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdminSession();

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "analytics";
  const filenamePrefix = type === "attribution" ? "luzela-attribution" : "luzela-analytics";
  const { csv, error } =
    type === "attribution"
      ? await getAttributionCsv({
          range: url.searchParams.get("range") || "30d",
          startDate: url.searchParams.get("start") || undefined,
          endDate: url.searchParams.get("end") || undefined,
          touch: url.searchParams.get("touch") || "last",
          source: url.searchParams.get("source") || "all",
          campaign: url.searchParams.get("campaign") || "all",
          product: url.searchParams.get("product") || "all",
        })
      : await getAnalyticsCsv({
          range: url.searchParams.get("range") || "30d",
          startDate: url.searchParams.get("start") || undefined,
          endDate: url.searchParams.get("end") || undefined,
        });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

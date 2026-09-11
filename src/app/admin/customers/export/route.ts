import { requireAdminSession } from "@/lib/auth/admin";
import { getCustomersCsv } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdminSession();

  const url = new URL(request.url);
  const { csv, error } = await getCustomersCsv({
    q: url.searchParams.get("q") || "",
    segment: url.searchParams.get("segment") || "all",
    sort: url.searchParams.get("sort") || "last_order",
    recent: url.searchParams.get("recent") || "",
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="luzela-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

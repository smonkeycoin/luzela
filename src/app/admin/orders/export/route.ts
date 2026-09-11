import { requireAdminSession } from "@/lib/auth/admin";
import { getOrdersCsv } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAdminSession();

  const url = new URL(request.url);
  const { csv, error } = await getOrdersCsv({
    filter: url.searchParams.get("filter") || "all",
    q: url.searchParams.get("q") || "",
  });

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="luzela-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

import Link from "next/link";
import { getCollabReport, type ReportParams } from "@/lib/collabs/report";
import { formatMoney } from "@/lib/money";
export async function CollabReportView({
  target,
  params,
  admin = false,
}: {
  target: string;
  params: ReportParams;
  admin?: boolean;
}) {
  let report;
  try {
    report = await getCollabReport(target, params);
  } catch (e) {
    return (
      <div className="p-6">
        <p role="alert">
          {e instanceof Error ? e.message : "Reporte no disponible."}
        </p>
        <Link
          href={admin ? "/admin/collaborations" : "/collab"}
          className="underline"
        >
          Volver al reporte
        </Link>
      </div>
    );
  }
  const money = (n: number) => formatMoney(n, "mxn");
  const base = admin ? "/admin/collaborations" : "/collab";
  const query = new URLSearchParams(
    Object.entries(params).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  query.set("collaborator", target);
  const page = Math.max(1, parseInt(params.page || "1") || 1);
  const next = new URLSearchParams(query);
  next.set("page", String(page + 1));
  const previous = new URLSearchParams(query);
  previous.set("page", String(page - 1));
  const kpis: [string, string][] = [
    ["Pedidos atribuidos", String(report.orders)],
    ["Unidades vendidas", String(report.units)],
    ["Mercancía antes de descuento", money(report.gross_merchandise)],
    ["Descuento otorgado", money(report.discount)],
    ["Ventas netas de mercancía", money(report.net_merchandise)],
    ["Ticket promedio · mercancía", money(report.aov)],
  ];
  if (admin)
    kpis.push(
      ["Envío cobrado", money(report.shipping)],
      ["Total cobrado", money(report.total)],
    );
  return (
    <section className="mt-8">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="collaborator" value={target} />
        <label className="grid gap-2 text-sm">
          Periodo
          <select
            name="range"
            defaultValue={params.range || "30d"}
            className="rounded border border-[var(--line)] bg-white p-3"
          >
            <option value="today">Hoy</option>
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="90d">90 días</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          Desde
          <input
            type="date"
            name="from"
            defaultValue={params.from}
            className="rounded border border-[var(--line)] bg-white p-3"
          />
        </label>
        <label className="grid gap-2 text-sm">
          Hasta
          <input
            type="date"
            name="to"
            defaultValue={params.to}
            className="rounded border border-[var(--line)] bg-white p-3"
          />
        </label>
        <button className="focus-ring rounded bg-[var(--ink)] px-5 py-3 text-white">
          Actualizar
        </button>
        <a
          href={`/collab/export?${query}`}
          className="focus-ring px-3 py-3 font-semibold underline"
        >
          Exportar CSV
        </a>
      </form>
      <p className="mt-3 text-xs text-[var(--muted)]">
        MXN · America/Cancun · Pedidos pagados por fecha de pago. Excluye
        cancelados y reembolsados. Ventas netas excluyen envío.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--line)] bg-white p-5"
          >
            <p className="text-xs text-[var(--muted)]">{label}</p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Conversión no disponible: no hay un conteo verificable de visitas para
        este reporte.
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="w-full min-w-[850px] text-left text-sm">
          <caption className="p-4 text-left font-semibold">
            Ventas atribuidas
          </caption>
          <thead className="bg-[#f1eee5]">
            <tr>
              {[
                "Fecha",
                "Pedido",
                "Productos",
                "Unidades",
                "Mercancía",
                "Descuento",
                "Venta neta",
                "Estado",
                "Atribución",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr
                key={row.order_number}
                className="border-t border-[var(--line)]"
              >
                <td className="p-3">
                  {new Date(row.date).toLocaleDateString("es-MX", {
                    timeZone: "America/Cancun",
                  })}
                </td>
                <td className="p-3">{row.order_number}</td>
                <td className="p-3">{row.product}</td>
                <td className="p-3">{row.units}</td>
                <td className="p-3">{money(row.gross_merchandise)}</td>
                <td className="p-3">−{money(row.discount)}</td>
                <td className="p-3">{money(row.net_merchandise)}</td>
                <td className="p-3">
                  {row.fulfillment_status} · {row.status}
                </td>
                <td className="p-3 capitalize">{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.rows.length ? (
          <p className="p-6 text-[var(--muted)]">
            Aún no hay ventas pagadas en este periodo.
          </p>
        ) : null}
      </div>
      <nav className="mt-4 flex gap-5 text-sm">
        {page > 1 ? <Link href={`${base}?${previous}`}>← Anterior</Link> : null}
        <span>Página {page}</span>
        {page * 100 < report.orders ? (
          <Link href={`${base}?${next}`}>Siguiente →</Link>
        ) : null}
      </nav>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {admin ? (
          <div className="rounded-xl border border-[var(--line)] bg-white p-5">
            <h3 className="font-semibold">Origen de atribución</h3>
            {report.sources.map((s) => (
              <p key={s.source} className="mt-3 text-sm">
                {s.source}: {s.orders} pedidos · {money(s.net_merchandise)}
              </p>
            ))}
          </div>
        ) : null}
        <div className="rounded-xl border border-[var(--line)] bg-white p-5">
          <h3 className="font-semibold">Mix de producto</h3>
          {report.products.length ? report.products.map((p) => (
            <p key={p.product} className="mt-3 text-sm">
              {p.product}: {p.units} unidades · {money(p.net_merchandise)}
            </p>
          )) : (
            <p className="mt-3 text-sm text-[var(--muted)]">Sin ventas en este periodo.</p>
          )}
        </div>
      </div>
    </section>
  );
}

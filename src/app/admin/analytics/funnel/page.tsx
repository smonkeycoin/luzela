import Link from "next/link";
import { getFunnel, getSummerDropPaidSummary, summarizeFunnel } from "@/lib/admin/funnel";
import { formatMoney } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSummerDropAvailability } from "@/lib/catalog/summer-drop";

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const query = await searchParams;
  const range = query.range === "today" || query.range === "7d" ? query.range : "30d";
  const { rows, measurementStart, error } = await getFunnel(range);
  const { steps, sources, products, summerDrop } = summarizeFunnel(rows);
  const [summerDropAvailability, summerDropPaidSummary] = await Promise.all([
    getSummerDropAvailability(createSupabaseAdminClient()),
    getSummerDropPaidSummary(),
  ]);
  return <main className="px-4 py-6 sm:px-6 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--teal)]">Analytics</p>
    <h1 className="mt-2 text-3xl font-semibold">Funnel</h1>
    <p className="mt-2 text-sm text-[var(--muted)]">{measurementStart
      ? `Medición iniciada el ${new Date(measurementStart).toLocaleString("es-MX", { timeZone: "America/Cancun" })}. No hay datos completos anteriores a esta fecha.`
      : "Medición de producción aún no iniciada. No hay datos completos anteriores al despliegue."}</p>
    {error ? <p className="mt-4 text-sm text-[var(--coral)]">{error}</p> : null}
    <nav className="mt-6 flex gap-2">{(["today", "7d", "30d"] as const).map((value) =>
      <Link key={value} href={`/admin/analytics/funnel?range=${value}`}
        className={`rounded-[8px] border px-3 py-2 text-sm ${range === value ? "bg-[var(--ink)] text-white" : "bg-white"}`}>
        {value === "today" ? "Hoy" : value === "7d" ? "7 días" : "30 días"}</Link>)}</nav>
    <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{steps.map((step, i) => {
      const previous = i ? steps[i - 1].count : 0;
      const rate = i && previous > 0 && step.count <= previous ? `${Math.round(step.count / previous * 100)}% del paso anterior` : "—";
      return <article key={step.name} className="surface rounded-[8px] p-5">
        <p className="text-sm text-[var(--muted)]">{step.label}</p><p className="mt-2 text-3xl font-semibold">{step.count}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{rate}</p></article>;
    })}</section>
    <section className="surface mt-6 rounded-[8px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--teal)]">Campaña · summer_drop</p>
      <h2 className="mt-2 text-xl font-semibold">Summer Drop</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Estado: {summerDropAvailability ? (summerDropAvailability.active && summerDropAvailability.remaining_packs > 0 ? "ACTIVE" : "AGOTADO / INACTIVO") : "No disponible; verifica la migración de campaña"}</p>
      {summerDropAvailability ? <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 xl:grid-cols-7">
        {[["Asignación", summerDropAvailability.allocation], ["Packs pagados", summerDropPaidSummary.paid_packs], ["Slots en checkout", summerDropAvailability.reserved_packs], ["Packs disponibles", summerDropAvailability.remaining_packs], ["Unidades físicas vendidas", summerDropPaidSummary.physical_units], ["Venta neta", formatMoney(summerDropPaidSummary.net_cents, "mxn")], ["Descuento acumulado", formatMoney(summerDropPaidSummary.discount_cents, "mxn")]].map(([label, value]) => <div key={String(label)}><dt className="text-[var(--muted)]">{label}</dt><dd className="mt-1 text-lg font-semibold">{value}</dd></div>)}
      </dl> : <p className="mt-3 text-sm text-[var(--muted)]">Activa la migración de allocation para consultar disponibilidad real.</p>}
      {summerDropPaidSummary.error ? <p className="mt-3 text-sm text-[var(--coral)]">{summerDropPaidSummary.error}</p> : null}
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 xl:grid-cols-8">
        {[["Sesiones", summerDrop.sessions], ["Vistas 3X", summerDrop.views], ["ATC", summerDrop.addToCart], ["Checkout", summerDrop.checkouts], ["Pago visto", summerDrop.paymentViews], ["Pago enviado", summerDrop.paymentSubmissions], ["Compras", summerDrop.purchases], ["Ventas netas", formatMoney(summerDrop.netCents, "mxn")]].map(([label, value]) => <div key={String(label)}><dt className="text-[var(--muted)]">{label}</dt><dd className="mt-1 text-lg font-semibold">{value}</dd></div>)}
      </dl>
    </section>
    <section className="surface mt-6 overflow-x-auto rounded-[8px] p-5"><h2 className="text-lg font-semibold">Por origen</h2>
      <table className="mt-4 w-full min-w-[650px] text-left text-sm"><thead><tr>{["Origen", "Sesiones", "ATC", "Checkout", "Compras", "Ventas netas de producto"].map((h) => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead>
      <tbody>{sources.map((row) => <tr key={row.name}><td className="p-2">{row.name}</td><td className="p-2">{row.sessions}</td><td className="p-2">{row.atc}</td><td className="p-2">{row.checkout}</td><td className="p-2">{row.purchases}</td><td className="p-2">{formatMoney(row.netCents, "mxn")}</td></tr>)}</tbody></table>
      {!sources.length ? <p className="mt-4 text-sm text-[var(--muted)]">Aún no hay eventos comerciales de producción en este período.</p> : null}
    </section>
    <section className="surface mt-6 overflow-x-auto rounded-[8px] p-5"><h2 className="text-lg font-semibold">Productos</h2>
      <table className="mt-4 w-full min-w-[700px] text-left text-sm"><thead><tr>{["Producto", "Vistas", "ATC", "Checkouts", "Compras", "Unidades", "Ventas netas"].map((h) => <th key={h} className="border-b p-2">{h}</th>)}</tr></thead>
      <tbody>{products.map((row) => <tr key={row.label}><td className="p-2">{row.label}</td><td className="p-2">{row.views}</td><td className="p-2">{row.atc}</td><td className="p-2">{row.checkouts}</td><td className="p-2">{row.purchases}</td><td className="p-2">{row.units}</td><td className="p-2">{formatMoney(row.netCents, "mxn")}</td></tr>)}</tbody></table>
    </section>
  </main>;
}

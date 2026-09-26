import Link from "next/link";
import { getFunnel, summarizeFunnel } from "@/lib/admin/funnel";
import { formatMoney } from "@/lib/money";

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const query = await searchParams;
  const range = query.range === "today" || query.range === "7d" ? query.range : "30d";
  const { rows, measurementStart, error } = await getFunnel(range);
  const { steps, sources, products } = summarizeFunnel(rows);
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

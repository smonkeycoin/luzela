import Link from "next/link";
import { Download } from "lucide-react";

import { ANALYTICS_RANGES } from "@/lib/admin/operations";
import { getAdminAnalytics } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";
import { getFeatureFlags } from "@/lib/settings";

const rangeLabels: Record<string, string> = {
  today: "Hoy",
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
  custom: "Custom",
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const range = String(query.range || "30d");
  const start = String(query.start || "");
  const end = String(query.end || "");
  const touch = String(query.touch || "last");
  const source = String(query.source || "all");
  const campaign = String(query.campaign || "all");
  const product = String(query.product || "all");
  const featureFlags = await getFeatureFlags();
  const { analytics, error } = featureFlags.analyticsEnabled
    ? await getAdminAnalytics({
        range,
        startDate: start,
        endDate: end,
        touch,
        source,
        campaign,
        product,
      })
    : { analytics: null, error: undefined };
  const exportHref = `/admin/analytics/export?${new URLSearchParams({
    range: analytics?.range || "30d",
    start,
    end,
  }).toString()}`;
  const attributionExportHref = `/admin/analytics/export?${new URLSearchParams({
    range: analytics?.range || "30d",
    start,
    end,
    type: "attribution",
    touch: analytics?.attribution.touch || "last",
    source,
    campaign,
    product,
  }).toString()}`;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Analytics
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Analytics</h1>
          <Link href="/admin/analytics/funnel" className="mt-3 inline-block text-sm font-semibold text-[var(--teal)] underline">Ver funnel</Link>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Entiende cómo está vendiendo Luzela.
          </p>
        </div>
        {featureFlags.analyticsEnabled ? (
          <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={attributionExportHref}
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[var(--teal)] px-3 text-sm font-semibold text-[var(--teal)]"
          >
            <Download size={16} aria-hidden />
            Export attribution
          </Link>
          <Link
            href={exportHref}
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[var(--ink)] px-3 text-sm font-semibold text-[var(--ink)]"
          >
            <Download size={16} aria-hidden />
            Exportar CSV
          </Link>
          </div>
        ) : null}
      </div>

      {!featureFlags.analyticsEnabled ? (
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Analytics desactivado</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Actívalo en Settings para consultar métricas y exportaciones.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-[8px] border border-[#f1d1c8] bg-white p-4 text-sm font-semibold text-[#9a392b]">
          {error}
        </div>
      ) : null}

      {featureFlags.analyticsEnabled ? (
      <div className="mt-5 flex gap-2 overflow-x-auto">
        {ANALYTICS_RANGES.map((item) => (
          <Link
            key={item}
            href={
              item === "custom" && start && end
                ? `/admin/analytics?range=custom&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
                : `/admin/analytics?range=${item}`
            }
            className={`focus-ring inline-flex h-10 shrink-0 items-center rounded-[8px] border px-3 text-sm font-semibold ${
              analytics?.range === item
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--line)] bg-white text-[var(--muted)]"
            }`}
          >
            {rangeLabels[item]}
          </Link>
        ))}
      </div>
      ) : null}

      {featureFlags.analyticsEnabled ? (
      <form className="surface mt-3 grid gap-3 rounded-[8px] p-4 sm:grid-cols-[160px_160px_auto] sm:items-end">
        <input type="hidden" name="range" value="custom" />
        <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
          Desde
          <input
            type="date"
            name="start"
            defaultValue={start}
            className="focus-ring h-10 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
          Hasta
          <input
            type="date"
            name="end"
            defaultValue={end}
            className="focus-ring h-10 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]"
          />
        </label>
        <button
          type="submit"
          className="focus-ring h-10 rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
        >
          Aplicar custom
        </button>
      </form>
      ) : null}

      {analytics ? (
        <>
          <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Kpi
              label="Revenue"
              value={formatMoney(analytics.summary.revenue_cents, analytics.currency)}
              previous={analytics.summary.previous_revenue_cents}
              current={analytics.summary.revenue_cents}
              currency={analytics.currency}
            />
            <Kpi
              label="Orders"
              value={String(analytics.summary.orders)}
              previous={analytics.summary.previous_orders}
              current={analytics.summary.orders}
            />
            <Kpi
              label="Units sold"
              value={String(analytics.summary.units_sold)}
              previous={analytics.summary.previous_units_sold}
              current={analytics.summary.units_sold}
            />
            <Kpi
              label="Average order value"
              value={formatMoney(analytics.summary.average_order_value_cents, analytics.currency)}
            />
            <Kpi label="New customers" value={String(analytics.summary.new_customers)} />
            <Kpi label="Returning customers" value={String(analytics.summary.returning_customers)} />
          </section>

          <section className="mt-5 grid gap-5">
            <article className="surface rounded-[8px] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
                    Adquisición
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">Revenue Attribution</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    UTM/source → paid order → revenue real. Sin clicks, CTR ni ROAS inventado.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={analyticsHref({ range: analytics.range, start, end, touch: "last", source, campaign, product })}
                    className={`focus-ring inline-flex h-10 items-center rounded-[8px] border px-3 text-xs font-semibold ${
                      analytics.attribution.touch === "last"
                        ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    Last touch
                  </Link>
                  <Link
                    href={analyticsHref({ range: analytics.range, start, end, touch: "first", source, campaign, product })}
                    className={`focus-ring inline-flex h-10 items-center rounded-[8px] border px-3 text-xs font-semibold ${
                      analytics.attribution.touch === "first"
                        ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--muted)]"
                    }`}
                  >
                    First touch
                  </Link>
                </div>
              </div>

              <form className="mt-5 grid gap-3 md:grid-cols-4">
                <input type="hidden" name="range" value={analytics.range} />
                <input type="hidden" name="touch" value={analytics.attribution.touch} />
                {start ? <input type="hidden" name="start" value={start} /> : null}
                {end ? <input type="hidden" name="end" value={end} /> : null}
                <SelectFilter
                  label="Source"
                  name="source"
                  value={source}
                  options={analytics.attribution.sources.map((item) => item.source)}
                />
                <SelectFilter
                  label="Campaign"
                  name="campaign"
                  value={campaign}
                  options={analytics.attribution.campaigns.map((item) => item.campaign)}
                />
                <SelectFilter
                  label="Product"
                  name="product"
                  value={product}
                  options={analytics.attribution.productsByCampaign.map((item) => item.product)}
                />
                <button
                  type="submit"
                  className="focus-ring h-10 rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
                >
                  Aplicar
                </button>
              </form>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <Kpi
                  label="Revenue atribuido"
                  value={formatMoney(analytics.attribution.revenue_cents, analytics.currency)}
                />
                <Kpi label="Orders" value={String(analytics.attribution.orders)} />
                <Kpi
                  label="AOV"
                  value={formatMoney(
                    analytics.attribution.average_order_value_cents,
                    analytics.currency,
                  )}
                />
                <Kpi
                  label="% revenue Meta"
                  value={`${analytics.attribution.meta_revenue_percentage}%`}
                />
              </div>
            </article>

            <section className="grid gap-5 2xl:grid-cols-2">
              <DataTable
                title="Source"
                headers={["Source", "Medium", "Orders", "Revenue", "AOV", "% Revenue"]}
                rows={analytics.attribution.sources.map((item) => [
                  item.source,
                  item.medium,
                  item.orders,
                  formatMoney(item.revenue_cents, analytics.currency),
                  formatMoney(item.average_order_value_cents, analytics.currency),
                  `${item.revenue_percentage}%`,
                ])}
              />
              <DataTable
                title="Campaign"
                headers={["Campaign", "Source", "Orders", "Revenue", "AOV", "Top product"]}
                rows={analytics.attribution.campaigns.map((item) => [
                  item.campaign,
                  item.source,
                  item.orders,
                  formatMoney(item.revenue_cents, analytics.currency),
                  formatMoney(item.average_order_value_cents, analytics.currency),
                  item.top_product,
                ])}
              />
              <DataTable
                title="Ad / Content"
                headers={["Ad / Content", "Campaign", "Orders", "Revenue", "AOV"]}
                rows={analytics.attribution.contents.map((item) => [
                  item.content,
                  item.campaign,
                  item.orders,
                  formatMoney(item.revenue_cents, analytics.currency),
                  formatMoney(item.average_order_value_cents, analytics.currency),
                ])}
              />
              <DataTable
                title="Product by campaign"
                headers={["Campaign", "Product", "Orders", "Physical units", "Revenue"]}
                rows={analytics.attribution.productsByCampaign.map((item) => [
                  item.campaign,
                  item.product,
                  item.orders,
                  item.physical_units,
                  formatMoney(item.revenue_cents, analytics.currency),
                ])}
              />
            </section>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className="surface rounded-[8px] p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Ventas por día</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Revenue y orders agrupadas por {analytics.timezone}.
                  </p>
                </div>
                <p className="text-xs font-semibold text-[var(--muted)]">
                  {rangeLabels[analytics.range]}
                </p>
              </div>
              {analytics.salesByDay.length ? (
                <RevenueChart days={analytics.salesByDay} currency={analytics.currency} />
              ) : (
                <EmptyState />
              )}
            </article>

            <article className="surface rounded-[8px] p-5">
              <h2 className="text-lg font-semibold">Customer analytics</h2>
              <div className="mt-4 grid gap-3">
                <InfoRow label="New customers" value={String(analytics.summary.new_customers)} />
                <InfoRow
                  label="Returning customers"
                  value={String(analytics.summary.returning_customers)}
                />
                <InfoRow
                  label="Repeat purchase rate"
                  value={`${analytics.summary.repeat_purchase_rate}%`}
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                Fórmula: customers con &gt;1 paid order / customers con &gt;=1 paid order.
              </p>
            </article>
          </section>

          <section className="mt-5 grid gap-5 2xl:grid-cols-2">
            <DataTable
              title="Sales by product"
              headers={["Product", "Revenue", "Orders", "Packs", "Units", "%"]}
              rows={analytics.salesByProduct.map((item) => [
                item.name,
                formatMoney(item.revenue_cents, analytics.currency),
                item.orders,
                item.packs_sold,
                item.physical_units,
                `${item.revenue_percentage}%`,
              ])}
            />
            <DataTable
              title="Offer performance"
              headers={["Product", "Original", "Effective", "Orders", "Revenue"]}
              rows={analytics.offerPerformance.map((item) => [
                item.product,
                formatMoney(item.original_price_cents, analytics.currency),
                formatMoney(item.effective_price_cents, analytics.currency),
                item.orders_sold,
                formatMoney(item.revenue_cents, analytics.currency),
              ])}
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-3">
            <article className="surface rounded-[8px] p-5">
              <h2 className="text-lg font-semibold">Top customers</h2>
              <div className="mt-4 grid gap-3">
                {analytics.topCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/admin/customers/${customer.id}`}
                    className="focus-ring grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[var(--line)] pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-[var(--ink)]">{customer.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {customer.orders} orders · {customer.last_order_at ? formatDate(customer.last_order_at) : "-"}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {formatMoney(customer.lifetime_spend_cents, analytics.currency)}
                    </p>
                  </Link>
                ))}
                {analytics.topCustomers.length === 0 ? <EmptyState /> : null}
              </div>
            </article>
            <DataTable
              title="Geography"
              headers={["Estado", "Ciudad", "Orders", "Revenue"]}
              rows={analytics.geography.map((item) => [
                item.state,
                item.city,
                item.orders,
                formatMoney(item.revenue_cents, analytics.currency),
              ])}
            />
            <article className="surface rounded-[8px] p-5">
              <h2 className="text-lg font-semibold">Fulfillment</h2>
              <div className="mt-4 grid gap-3">
                <InfoRow label="Pending" value={String(analytics.fulfillment.pending)} />
                <InfoRow label="Preparing" value={String(analytics.fulfillment.preparing)} />
                <InfoRow label="Shipped" value={String(analytics.fulfillment.shipped)} />
                <InfoRow label="Delivered" value={String(analytics.fulfillment.delivered)} />
                <InfoRow
                  label="Paid → Shipped avg"
                  value={
                    analytics.fulfillment.paid_to_shipped_average_hours === null
                      ? "Sin datos suficientes"
                      : `${analytics.fulfillment.paid_to_shipped_average_hours}h`
                  }
                />
              </div>
            </article>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-3">
            <article className="surface rounded-[8px] p-5">
              <h2 className="text-lg font-semibold">Email metrics</h2>
              <div className="mt-4 grid gap-3">
                <InfoRow
                  label="Order confirmation sent"
                  value={String(analytics.email.order_confirmation_sent)}
                />
                <InfoRow
                  label="Shipping confirmation sent"
                  value={String(analytics.email.shipping_confirmation_sent)}
                />
                <InfoRow label="Failed" value={String(analytics.email.failed)} />
                <InfoRow label="Skipped" value={String(analytics.email.skipped)} />
              </div>
            </article>
            <article className="surface rounded-[8px] p-5">
              <h2 className="text-lg font-semibold">Inventory</h2>
              <div className="mt-4 grid gap-3">
                <InfoRow label="Physical stock" value={String(analytics.inventory.physical_stock)} />
                <InfoRow label="Units sold period" value={String(analytics.inventory.units_sold_period)} />
                <InfoRow
                  label="Estimated days of stock"
                  value={
                    analytics.inventory.estimated_days_of_stock === null
                      ? "Sin historial suficiente"
                      : String(analytics.inventory.estimated_days_of_stock)
                  }
                />
              </div>
            </article>
            <article className="surface rounded-[8px] p-5">
              <h2 className="text-lg font-semibold">Failures / refunds</h2>
              <div className="mt-4 grid gap-3">
                <InfoRow label="Failed payments" value={String(analytics.failures.failed_payments)} />
                <InfoRow label="Cancelled orders" value={String(analytics.failures.cancelled_orders)} />
                <InfoRow label="Refunds" value={String(analytics.failures.refunds)} />
              </div>
            </article>
          </section>
        </>
      ) : (
        <EmptyState />
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  current,
  previous,
  currency,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  currency?: string;
}) {
  const delta =
    typeof current === "number" && typeof previous === "number"
      ? current - previous
      : null;

  return (
    <article className="surface rounded-[8px] p-4">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-[var(--ink)]">{value}</p>
      {delta !== null ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          vs periodo anterior:{" "}
          {currency ? formatMoney(delta, currency) : delta > 0 ? `+${delta}` : String(delta)}
        </p>
      ) : null}
    </article>
  );
}

function RevenueChart({
  days,
  currency,
}: {
  days: Array<{ day: string; revenue_cents: number; orders: number }>;
  currency: string;
}) {
  const maxRevenue = Math.max(...days.map((day) => day.revenue_cents), 1);

  return (
    <div className="mt-5 grid gap-3">
      <div className="flex h-64 items-end gap-2 overflow-x-auto border-b border-l border-[var(--line)] px-2 pb-2">
        {days.map((day) => {
          const height = Math.max(8, Math.round((day.revenue_cents / maxRevenue) * 220));

          return (
            <div key={day.day} className="flex min-w-12 flex-col items-center justify-end gap-2">
              <div
                className="w-8 rounded-t-[6px] bg-[#0f766e]"
                style={{ height }}
                title={`${day.day}: ${formatMoney(day.revenue_cents, currency)} · ${day.orders} orders`}
              />
              <p className="text-[10px] text-[var(--muted)]">{day.day.slice(5)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <article className="surface min-w-0 overflow-hidden rounded-[8px]">
      <div className="p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {rows.length ? (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-y border-[var(--line)] text-xs uppercase text-[var(--muted)]">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-5 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-b border-[var(--line)] last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`} className="px-5 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 pb-5">
          <EmptyState />
        </div>
      )}
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function SelectFilter({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[];
  value: string;
}) {
  const uniqueOptions = [...new Set(options.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es-MX"),
  );

  return (
    <label className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="focus-ring h-10 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)]"
      >
        <option value="all">Todos</option>
        {uniqueOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function analyticsHref({
  campaign,
  end,
  product,
  range,
  source,
  start,
  touch,
}: {
  campaign: string;
  end: string;
  product: string;
  range: string;
  source: string;
  start: string;
  touch: string;
}) {
  const params = new URLSearchParams({ range, touch });

  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (source !== "all") params.set("source", source);
  if (campaign !== "all") params.set("campaign", campaign);
  if (product !== "all") params.set("product", product);

  return `/admin/analytics?${params.toString()}`;
}

function EmptyState() {
  return (
    <p className="text-sm leading-6 text-[var(--muted)]">
      Todavía no hay suficientes datos para este periodo.
    </p>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

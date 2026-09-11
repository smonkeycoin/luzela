import Link from "next/link";
import { Download, Search } from "lucide-react";

import { CUSTOMER_SEGMENTS, CUSTOMER_SORTS } from "@/lib/admin/operations";
import { getAdminCustomersWithFilters } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

const segmentLabels: Record<string, string> = {
  all: "Todos",
  new: "Nuevos",
  returning: "Recurrentes",
  vip: "VIP",
};

const sortLabels: Record<string, string> = {
  last_order: "Última compra",
  lifetime_spend: "Lifetime spend",
  orders: "Órdenes",
  name: "Nombre",
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const q = String(query.q || "");
  const segment = String(query.segment || "all");
  const sort = String(query.sort || "last_order");
  const recent = String(query.recent || "");
  const { customers, filters, error } = await getAdminCustomersWithFilters({
    q,
    segment,
    sort,
    recent,
  });
  const exportHref = `/admin/customers/export?${new URLSearchParams({
    q,
    segment: filters.segment,
    sort: filters.sort,
    recent: filters.recent ? "30d" : "",
  }).toString()}`;

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[#e6ded3] pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e]">
            Clientes
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#171310]">Customers</h1>
          <p className="mt-2 text-sm text-[#716a63]">
            Quién compró, cuánto ha gastado y cuándo volvió.
          </p>
        </div>
        <Link
          href={exportHref}
          className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#173f3a] px-3 text-sm font-semibold text-[#173f3a]"
        >
          <Download size={16} aria-hidden />
          Exportar CSV
        </Link>
      </div>

      {error ? (
        <div className="mt-5 rounded-[8px] border border-[#f1d1c8] bg-white p-4 text-sm font-semibold text-[#9a392b]">
          {error}
        </div>
      ) : null}

      <section className="surface mt-5 rounded-[8px] p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
          <form className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#716a63]"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                className="focus-ring h-11 w-full rounded-[8px] border border-[#e4dbcf] bg-white pl-10 pr-3 text-sm font-semibold"
                placeholder="Nombre, email o teléfono"
              />
            </div>
            <select
              name="segment"
              defaultValue={filters.segment}
              className="focus-ring h-11 rounded-[8px] border border-[#e4dbcf] bg-white px-3 text-sm font-semibold"
            >
              {CUSTOMER_SEGMENTS.map((item) => (
                <option key={item} value={item}>
                  {segmentLabels[item]}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={filters.sort}
              className="focus-ring h-11 rounded-[8px] border border-[#e4dbcf] bg-white px-3 text-sm font-semibold"
            >
              {CUSTOMER_SORTS.map((item) => (
                <option key={item} value={item}>
                  {sortLabels[item]}
                </option>
              ))}
            </select>
            <label className="focus-within:ring-ring inline-flex h-11 items-center gap-2 rounded-[8px] border border-[#e4dbcf] bg-white px-3 text-sm font-semibold text-[#716a63]">
              <input
                type="checkbox"
                name="recent"
                value="30d"
                defaultChecked={filters.recent}
              />
              30 días
            </label>
            <button
              type="submit"
              className="focus-ring h-11 rounded-[8px] bg-[#173f3a] px-4 text-sm font-semibold text-white md:col-span-4 xl:col-span-1"
            >
              Aplicar
            </button>
          </form>
          <p className="text-sm text-[#716a63]">{customers.length} perfiles</p>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[8px] border border-[#e6ded3] bg-white">
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-[#8a8178]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Órdenes</th>
                <th className="px-4 py-3">Lifetime spend</th>
                <th className="px-4 py-3">Ticket promedio</th>
                <th className="px-4 py-3">Última compra</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <CustomerTableRow key={customer.id} customer={customer} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 xl:hidden">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/admin/customers/${customer.id}`}
              className="focus-ring rounded-[8px] border border-[#eee6dc] bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#173f3a]">{customer.name}</p>
                  <p className="mt-1 text-sm text-[#716a63]">{customer.email}</p>
                  <p className="mt-1 text-sm text-[#716a63]">
                    {customer.phone || "Sin teléfono"}
                  </p>
                </div>
                <SegmentBadge segment={customer.segment} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <MiniStat label="Órdenes" value={String(customer.paid_orders_count)} />
                <MiniStat label="Spend" value={formatMoney(customer.lifetime_spend_cents)} />
                <MiniStat
                  label="AOV"
                  value={formatMoney(customer.average_order_value_cents)}
                />
              </div>
            </Link>
          ))}
        </div>

        {customers.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#716a63]">
            Todavía no hay customers para este filtro.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function CustomerTableRow({
  customer,
}: {
  customer: Awaited<ReturnType<typeof getAdminCustomersWithFilters>>["customers"][number];
}) {
  return (
    <tr className="border-t border-[#f0e8de] hover:bg-[#faf7f1]">
      <td className="px-4 py-3">
        <Link
          href={`/admin/customers/${customer.id}`}
          className="focus-ring font-semibold text-[#173f3a] hover:text-[#0f766e]"
        >
          {customer.name}
        </Link>
        <p className="text-xs text-[#716a63]">
          {[customer.city, customer.state].filter(Boolean).join(", ") || "Sin ubicación"}
        </p>
      </td>
      <td className="px-4 py-3 text-[#716a63]">{customer.email}</td>
      <td className="px-4 py-3 text-[#716a63]">{customer.phone || "Sin teléfono"}</td>
      <td className="px-4 py-3 font-semibold">{customer.paid_orders_count}</td>
      <td className="px-4 py-3 font-semibold">{formatMoney(customer.lifetime_spend_cents)}</td>
      <td className="px-4 py-3 font-semibold">
        {formatMoney(customer.average_order_value_cents)}
      </td>
      <td className="px-4 py-3 text-[#716a63]">
        {customer.last_order_at ? formatDate(customer.last_order_at) : "-"}
      </td>
      <td className="px-4 py-3">
        <SegmentBadge segment={customer.segment} />
      </td>
    </tr>
  );
}

function SegmentBadge({ segment }: { segment: string }) {
  const label = segmentLabels[segment] || segment;
  const palette =
    segment === "vip"
      ? "border-[#e8cf96] bg-[#fff7de] text-[#866018]"
      : segment === "returning"
        ? "border-[#cce8d7] bg-[#e7f5ec] text-[#1f6b43]"
        : "border-[#d9ece8] bg-[#f1fbf8] text-[#0f5f58]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${palette}`}>
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[#716a63]">{label}</p>
      <p className="mt-1 truncate font-semibold text-[#171310]">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

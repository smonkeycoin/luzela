import Link from "next/link";
import { Download, Search } from "lucide-react";

import { ADMIN_ORDER_FILTERS } from "@/lib/admin/operations";
import { getAdminOrders } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

const filterLabels: Record<string, string> = {
  all: "Todas",
  attention: "Requieren atención",
  to_prepare: "Por preparar",
  preparing: "Preparando",
  shipped: "Enviadas",
  delivered: "Entregadas",
  cancelled: "Canceladas",
};

const paymentLabels: Record<string, string> = {
  paid: "Pago confirmado",
  requires_payment: "Pago pendiente",
  not_started: "Pago no iniciado",
  failed: "Pago fallido",
  refunded: "Pago reembolsado",
  partially_refunded: "Pago parcialmente reembolsado",
};

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "Por preparar",
  preparing: "Preparando",
  ready_to_ship: "Listo para enviar",
  shipped: "Enviada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const filter = String(query.filter || "all");
  const q = String(query.q || "");
  const { orders, error } = await getAdminOrders({ filter, q });
  const exportHref = `/admin/orders/export?${new URLSearchParams({ filter, q }).toString()}`;

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Operación de pedidos
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Orders</h1>
        </div>
        <Link
          href={exportHref}
          className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[var(--ink)] px-3 text-sm font-semibold text-[var(--ink)]"
        >
          <Download size={16} aria-hidden />
          Exportar CSV
        </Link>
      </div>

      {error ? (
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-white p-4 text-sm font-semibold text-[var(--coral)]">
          {error}
        </div>
      ) : null}

      <section className="surface mt-6 rounded-[8px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {ADMIN_ORDER_FILTERS.map((item) => (
              <Link
                key={item}
                href={`/admin/orders?filter=${item}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`focus-ring rounded-[8px] border px-3 py-2 text-xs font-semibold ${
                  filter === item
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)]"
                }`}
              >
                {filterLabels[item]}
              </Link>
            ))}
          </div>
          <form className="relative w-full xl:w-80">
            <input type="hidden" name="filter" value={filter} />
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              size={16}
              aria-hidden
            />
            <input
              name="q"
              defaultValue={q}
              className="focus-ring h-11 w-full rounded-[8px] border border-[var(--line)] bg-white pl-10 pr-3 text-sm font-semibold"
              placeholder="Buscar order, email, nombre, tracking"
            />
          </form>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="py-3 pr-4">Order #</th>
                <th className="py-3 pr-4">Fecha</th>
                <th className="py-3 pr-4">Cliente</th>
                <th className="py-3 pr-4">Pack</th>
                <th className="py-3 pr-4">Packs</th>
                <th className="py-3 pr-4">Unidades físicas</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Provider</th>
                <th className="py-3 pr-4">Payment</th>
                <th className="py-3 pr-4">Fulfillment</th>
                <th className="py-3 pr-4">Email</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-3 pr-4 font-semibold">
                    <Link className="hover:underline" href={`/admin/orders/${order.id}`}>
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{new Date(order.created_at).toLocaleString("es-MX")}</td>
                  <td className="py-3 pr-4">
                    {order.customer_id ? (
                      <Link
                        className="font-semibold hover:text-[var(--teal)]"
                        href={`/admin/customers/${order.customer_id}`}
                      >
                        {order.customer_name}
                      </Link>
                    ) : (
                      <p className="font-semibold">{order.customer_name}</p>
                    )}
                    <p className="text-xs text-[var(--muted)]">{order.customer_email}</p>
                  </td>
                  <td className="py-3 pr-4">{order.pack_label}</td>
                  <td className="py-3 pr-4">{order.packs}</td>
                  <td className="py-3 pr-4">{order.physical_units}</td>
                  <td className="py-3 pr-4">{formatMoney(order.total_cents, order.currency)}</td>
                  <td className="py-3 pr-4">{order.payment_provider}</td>
                  <td className="py-3 pr-4">
                    {paymentLabels[order.payment_status] || order.payment_status}
                  </td>
                  <td className="py-3 pr-4">
                    {fulfillmentLabels[order.fulfillment_status] || order.fulfillment_status}
                  </td>
                  <td className="py-3 pr-4">{order.email_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <p className="py-6 text-sm text-[var(--muted)]">No hay órdenes para este filtro.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

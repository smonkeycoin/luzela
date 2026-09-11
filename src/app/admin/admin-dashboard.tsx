"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PackageCheck,
  Truck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  AdminActivityItem,
  AdminDashboardOrder,
  AdminOrderCountKey,
  AdminProductSales,
} from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

import { markOrderDelivered, markOrderPreparing } from "./orders/[orderId]/actions";

type Metrics = {
  salesTodayCents: number;
  salesYesterdayCents: number;
  salesLast7Cents: number;
  paidOrders: number;
  toPrepare: number;
  shipped: number;
  physicalStock: number;
  averageTicketCents: number;
  unitsSold: number;
} | null;

type Pending = {
  toPrepare: number;
  readyToShip: number;
  lowStock: number;
  failedEmails: number;
} | null;

const filterLabels: { key: AdminOrderCountKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "attention", label: "Requieren atención" },
  { key: "to_prepare", label: "Por preparar" },
  { key: "preparing", label: "Preparando" },
  { key: "shipped", label: "Enviadas" },
  { key: "delivered", label: "Entregadas" },
  { key: "cancelled", label: "Canceladas" },
];

const paymentLabels: Record<string, string> = {
  paid: "Pagado",
  requires_payment: "Pago pendiente",
  not_started: "Pago no iniciado",
  failed: "Fallido",
  refunded: "Refunded",
  partially_refunded: "Refunded",
};

const fulfillmentLabels: Record<string, string> = {
  unfulfilled: "Por preparar",
  preparing: "Preparando",
  ready_to_ship: "Preparando",
  shipped: "Enviada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

export function AdminDashboard({
  metrics,
  pending,
  orders,
  orderCounts,
  salesByProduct,
  activity,
  shippingCarrier,
}: {
  metrics: Metrics;
  pending: Pending;
  orders: AdminDashboardOrder[];
  orderCounts: Record<AdminOrderCountKey, number>;
  salesByProduct: AdminProductSales[];
  activity: AdminActivityItem[];
  shippingCarrier: string;
}) {
  const [activeFilter, setActiveFilter] = useState<AdminOrderCountKey>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const rowsPerPage = 6;
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (activeFilter === "all") {
          return true;
        }

        return matchesDashboardFilter(order, activeFilter);
      }),
    [activeFilter, orders],
  );
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / rowsPerPage));
  const visibleOrders = filteredOrders.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;
  const todayDelta = getDelta(metrics?.salesTodayCents || 0, metrics?.salesYesterdayCents || 0);
  const trendValues = [0.24, 0.38, 0.32, 0.58, 0.46, 0.72, 0.66];

  function setFilter(filter: AdminOrderCountKey) {
    setActiveFilter(filter);
    setPage(1);
  }

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <MetricCard
          label="Ventas hoy"
          value={formatMoney(metrics?.salesTodayCents ?? 0)}
          note={todayDelta}
          trendValues={trendValues}
        />
        <MetricCard
          label="Ventas 7 días"
          value={formatMoney(metrics?.salesLast7Cents ?? 0)}
          note="Ventana móvil real"
          trendValues={trendValues.slice().reverse()}
        />
        <MetricCard label="Órdenes pagadas" value={String(metrics?.paidOrders ?? 0)} note="Confirmadas" />
        <MetricCard
          label="Requieren atención"
          value={String((pending?.toPrepare ?? 0) + (pending?.readyToShip ?? 0))}
          note="Órdenes operativas"
        />
        <MetricCard label="Enviadas" value={String(metrics?.shipped ?? 0)} note="En camino" />
        <MetricCard
          label="Inventario físico"
          value={String(metrics?.physicalStock ?? 0)}
          note="Luzelas disponibles"
        />
        <MetricCard
          label="Ticket promedio"
          value={formatMoney(metrics?.averageTicketCents ?? 0)}
          note="Órdenes pagadas"
        />
      </section>

      <section className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <article className="rounded-[12px] border border-[#e6ded3] bg-white">
            <div className="flex flex-col gap-4 border-b border-[#eee6dc] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#171310]">Órdenes recientes</h2>
                <p className="text-sm text-[#716a63]">Vista rápida para operar el día.</p>
              </div>
              <Link
                href="/admin/orders"
                className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-[#0f766e]"
              >
                Ver todas las órdenes <ArrowRight size={16} aria-hidden />
              </Link>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-[#eee6dc] px-4 py-3">
              {filterLabels.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setFilter(filter.key)}
                  className={`focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                    activeFilter === filter.key
                      ? "border-[#0f766e] bg-[#dff1ed] text-[#0f5f58]"
                      : "border-[#e6ded3] bg-white text-[#716a63] hover:bg-[#faf7f1]"
                  }`}
                >
                  {filter.label}
                  {orderCounts[filter.key] > 0 ? (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px]">
                      {orderCounts[filter.key]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="text-xs font-semibold uppercase text-[#8a8178]">
                  <tr>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Estado pago</th>
                    <th className="px-4 py-3">Estatus envío</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`border-t border-[#f0e8de] transition hover:bg-[#faf7f1] ${
                        selectedOrderId === order.id ? "bg-[#f5fbf9]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="focus-ring text-left font-semibold text-[#173f3a] hover:text-[#0f766e]"
                        >
                          {order.order_number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {order.customer_id ? (
                          <Link
                            href={`/admin/customers/${order.customer_id}`}
                            className="focus-ring font-semibold text-[#171310] hover:text-[#0f766e]"
                          >
                            {order.customer_name}
                          </Link>
                        ) : (
                          <p className="font-semibold">{order.customer_name}</p>
                        )}
                        <p className="text-xs text-[#716a63]">{order.customer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ProductCell order={order} />
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {formatMoney(order.total_cents, order.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="payment" value={order.payment_status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge kind="shipping" value={order.fulfillment_status} />
                      </td>
                      <td className="px-4 py-3 text-[#716a63]">{order.created_label}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="focus-ring text-xs font-semibold text-[#0f766e]"
                        >
                          Detalles
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 xl:hidden">
              {visibleOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className="focus-ring rounded-[12px] border border-[#eee6dc] bg-white p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#173f3a]">{order.order_number}</p>
                      <p className="mt-1 text-sm text-[#716a63]">{order.customer_name}</p>
                    </div>
                    <StatusBadge kind="shipping" value={order.fulfillment_status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <ProductCell order={order} />
                    <p className="font-semibold">{formatMoney(order.total_cents, order.currency)}</p>
                  </div>
                </button>
              ))}
            </div>

            {visibleOrders.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#716a63]">No hay órdenes para este filtro.</p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-[#eee6dc] p-4 text-sm text-[#716a63] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Mostrando {visibleOrders.length} de {filteredOrders.length} órdenes
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#e6ded3] bg-white disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="text-xs font-semibold">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page === totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#e6ded3] bg-white disabled:opacity-40"
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </div>
          </article>

          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            <AttentionModule pending={pending} />
            <SalesModule sales={salesByProduct} />
            <ActivityModule activity={activity} />
          </div>
        </div>

        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          shippingCarrier={shippingCarrier}
        />
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  note,
  trendValues,
}: {
  label: string;
  value: string;
  note: string;
  trendValues?: number[];
}) {
  return (
    <article className="rounded-[12px] border border-[#e6ded3] bg-white p-4">
      <p className="text-[12px] font-semibold text-[#716a63]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="break-words text-[26px] font-semibold leading-none text-[#171310]">{value}</p>
        {trendValues ? <Sparkline values={trendValues} /> : null}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-[#716a63]">{note}</p>
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const points = values
    .map((value, index) => `${index * 12},${28 - value * 24}`)
    .join(" ");

  return (
    <svg viewBox="0 0 72 32" className="h-8 w-[72px]" aria-hidden>
      <polyline fill="none" stroke="#0f766e" strokeWidth="2" points={points} />
    </svg>
  );
}

function ProductCell({ order }: { order: AdminDashboardOrder }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/luzela/bottle.webp"
        alt=""
        width={34}
        height={42}
        className="h-11 w-9 rounded-[8px] bg-[#f5f1ea] object-contain p-1"
      />
      <div>
        <p className="font-semibold text-[#171310]">{order.product.name}</p>
        <p className="text-xs text-[#716a63]">
          {order.product.physical_units || order.physical_units} Luzelas
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ kind, value }: { kind: "payment" | "shipping"; value: string }) {
  const palette =
    value === "paid" || value === "delivered"
      ? "bg-[#e7f5ec] text-[#1f6b43] border-[#cce8d7]"
      : value === "failed" || value === "cancelled"
        ? "bg-[#fff0ec] text-[#9a392b] border-[#f1d1c8]"
        : value === "shipped"
          ? "bg-[#eef5ff] text-[#315f8f] border-[#d8e8fb]"
          : value === "preparing" || value === "ready_to_ship"
            ? "bg-[#fff5e4] text-[#946018] border-[#f0dfbf]"
            : "bg-[#fff9db] text-[#7b6418] border-[#efe3a8]";
  const label = kind === "payment" ? paymentLabels[value] || value : fulfillmentLabels[value] || value;

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${palette}`}>
      {label}
    </span>
  );
}

function AttentionModule({ pending }: { pending: Pending }) {
  const rows = [
    { label: "órdenes por preparar", value: pending?.toPrepare ?? 0, href: "/admin/orders?filter=to_prepare" },
    { label: "envíos preparando sin guía", value: pending?.readyToShip ?? 0, href: "/admin/shipping?view=preparing" },
    { label: "emails fallidos", value: pending?.failedEmails ?? 0, href: "/admin/shipping?view=problems" },
    { label: "inventario bajo", value: pending?.lowStock ?? 0, href: "/admin/inventory" },
  ];

  return (
    <article className="rounded-[12px] border border-[#e6ded3] bg-white p-4">
      <h2 className="text-base font-semibold">Pendientes de atención</h2>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-8 text-lg font-semibold text-[#173f3a]">{row.value}</span>
              <span className="text-sm text-[#716a63]">{row.label}</span>
            </div>
            <Link href={row.href} className="focus-ring text-xs font-semibold text-[#0f766e]">
              Ver
            </Link>
          </div>
        ))}
      </div>
    </article>
  );
}

function SalesModule({ sales }: { sales: AdminProductSales[] }) {
  return (
    <article className="rounded-[12px] border border-[#e6ded3] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">Ventas por producto (7 días)</h2>
        <Link href="/admin/analytics" className="focus-ring text-xs font-semibold text-[#0f766e]">
          Analytics
        </Link>
      </div>
      {sales.length ? (
        <div className="mt-4 grid gap-4">
          <div
            className="mx-auto h-24 w-24 rounded-full p-4"
            style={{ background: buildDonutGradient(sales) }}
          >
            <div className="h-full w-full rounded-full bg-white" />
          </div>
          <div className="grid gap-3">
            {sales.map((item) => (
              <div key={item.name} className="grid grid-cols-[1fr_auto] gap-3 text-sm">
                <div>
                  <p className="font-semibold text-[#171310]">{item.name}</p>
                  <p className="text-xs text-[#716a63]">{item.percentage}% · {item.quantity} packs</p>
                </div>
                <p className="font-semibold">{formatMoney(item.revenue_cents)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#716a63]">
          Aún no hay ventas pagadas suficientes en los últimos 7 días.
        </p>
      )}
    </article>
  );
}

function ActivityModule({ activity }: { activity: AdminActivityItem[] }) {
  return (
    <article className="rounded-[12px] border border-[#e6ded3] bg-white p-4">
      <h2 className="text-base font-semibold">Actividad reciente</h2>
      <div className="mt-4 grid gap-3">
        {activity.map((item) => (
          <Link key={item.id} href={item.href} className="focus-ring grid gap-1 border-l border-[#d9ece8] pl-3">
            <p className="text-sm font-semibold text-[#171310]">{item.label}</p>
            <p className="text-xs text-[#716a63]">{item.description}</p>
          </Link>
        ))}
        {activity.length === 0 ? <p className="text-sm text-[#716a63]">Sin actividad registrada.</p> : null}
      </div>
    </article>
  );
}

function buildDonutGradient(sales: AdminProductSales[]) {
  const colors = ["#0f766e", "#8fc7bd", "#f2b84b", "#d9c4a2"];
  const total = sales.reduce((sum, item) => sum + item.revenue_cents, 0);
  let cursor = 0;
  const stops = sales.map((item, index) => {
    const start = cursor;
    const size = total ? (item.revenue_cents / total) * 100 : 0;
    cursor += size;

    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function OrderDrawer({
  order,
  onClose,
  shippingCarrier,
}: {
  order: AdminDashboardOrder | null;
  onClose: () => void;
  shippingCarrier: string;
}) {
  if (!order) {
    return (
      <aside className="hidden rounded-[12px] border border-dashed border-[#e6ded3] bg-white p-5 text-sm text-[#716a63] 2xl:block">
        Selecciona una orden para revisar el panel operativo.
      </aside>
    );
  }

  const shippedAt = order.shipment?.shipped_at || order.paid_at || order.created_at;
  const estimate = order.shipment?.shipped_at ? getDhlEstimate(order.shipment.shipped_at) : null;
  const customerLocation = [order.customer_city, order.customer_state, order.customer_country]
    .filter(Boolean)
    .join(", ");

  return (
    <aside className="fixed inset-0 z-50 overflow-y-auto bg-[#faf9f6] p-4 sm:left-auto sm:w-[400px] sm:border-l sm:border-[#e6ded3] sm:bg-white 2xl:sticky 2xl:top-[88px] 2xl:z-auto 2xl:max-h-[calc(100vh-108px)] 2xl:rounded-[12px] 2xl:border 2xl:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#716a63]">Orden seleccionada</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#173f3a]">{order.order_number}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e6ded3] bg-white"
          aria-label="Cerrar orden"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <StatusBadge kind="payment" value={order.payment_status} />
        <StatusBadge kind="shipping" value={order.fulfillment_status} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniSummary
          icon={<Truck size={16} aria-hidden />}
          label={fulfillmentLabels[order.fulfillment_status] || order.fulfillment_status}
          value={formatShortDate(shippedAt)}
        />
        <MiniSummary
          icon={<PackageCheck size={16} aria-hidden />}
          label={estimate ? "Entrega estimada" : "Siguiente paso"}
          value={estimate || getNextStep(order)}
        />
      </div>

      <DrawerSection
        title="Cliente"
        action={
          order.customer_id ? (
            <Link href={`/admin/customers/${order.customer_id}`} className="text-xs font-semibold text-[#0f766e]">
              Ver perfil
            </Link>
          ) : null
        }
      >
        <p className="font-semibold text-[#171310]">{order.customer_name}</p>
        <p className="mt-1 text-sm text-[#716a63]">{order.customer_email}</p>
        <p className="mt-1 text-sm text-[#716a63]">{order.customer_phone || "Sin teléfono"}</p>
        <p className="mt-1 text-sm text-[#716a63]">{customerLocation || "Sin ciudad guardada"}</p>
      </DrawerSection>

      <DrawerSection title="Producto">
        <div className="flex items-center justify-between gap-3">
          <ProductCell order={order} />
          <div className="text-right">
            <p className="text-sm font-semibold">x{order.product.quantity || order.packs}</p>
            <p className="text-sm text-[#716a63]">{formatMoney(order.product.subtotal_cents, order.currency)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-[#716a63]">
          {order.product.units_per_pack} Luzelas por pack ·{" "}
          {formatMoney(order.product.unit_price_cents / Math.max(1, order.product.units_per_pack), order.currency)} c/u
        </p>
      </DrawerSection>

      <DrawerSection title="Shipping">
        <div className="grid gap-2 text-sm">
          <p className="font-semibold text-[#171310]">
            {order.shipment?.carrier || shippingCarrier}
          </p>
          <p className="text-[#716a63]">Guía: {order.shipment?.tracking_number || "Sin guía"}</p>
          {order.shipment?.tracking_url ? (
            <a
              href={order.shipment.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-[#0f766e]"
            >
              Rastrear envío <ExternalLink size={14} aria-hidden />
            </a>
          ) : (
            <Link href={`/admin/orders/${order.id}`} className="focus-ring text-sm font-semibold text-[#0f766e]">
              Agregar guía
            </Link>
          )}
          {order.shipment?.delivered_at ? (
            <p className="text-xs text-[#716a63]">Entregado {formatShortDate(order.shipment.delivered_at)}</p>
          ) : null}
        </div>
      </DrawerSection>

      <DrawerSection title="Resumen">
        <SummaryRow label="Subtotal" value={formatMoney(order.subtotal_cents, order.currency)} />
        <SummaryRow
          label="Envío"
          value={order.shipping_cents ? formatMoney(order.shipping_cents, order.currency) : "Incluido"}
        />
        {order.discount_cents ? (
          <SummaryRow label="Descuento" value={`-${formatMoney(order.discount_cents, order.currency)}`} />
        ) : null}
        <SummaryRow label="Total" value={formatMoney(order.total_cents, order.currency)} strong />
      </DrawerSection>

      <div className="sticky bottom-0 -mx-4 mt-5 grid gap-2 border-t border-[#e6ded3] bg-[#faf9f6] p-4 sm:-mx-5 sm:bg-white">
        <Link
          href={`/admin/orders/${order.id}`}
          className="focus-ring inline-flex h-11 items-center justify-center rounded-[10px] bg-[#173f3a] px-4 text-sm font-semibold text-white"
        >
          Ver detalles completos
        </Link>
        <div className="grid grid-cols-2 gap-2">
          {order.fulfillment_status === "unfulfilled" && order.payment_status === "paid" ? (
            <form action={markOrderPreparing.bind(null, order.id)}>
              <input type="hidden" name="confirm" value="yes" />
              <button
                type="submit"
                className="focus-ring inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#e6ded3] text-sm font-semibold text-[#173f3a]"
              >
                Marcar preparando
              </button>
            </form>
          ) : (
            <Link
              href={`/admin/orders/${order.id}`}
              className="focus-ring inline-flex h-10 items-center justify-center rounded-[10px] border border-[#e6ded3] text-sm font-semibold text-[#173f3a]"
            >
              {order.shipment ? "Editar envío" : getNextStep(order)}
            </Link>
          )}
          {order.fulfillment_status === "shipped" && order.shipment ? (
            <form action={markOrderDelivered.bind(null, order.id)}>
              <input type="hidden" name="confirm" value="yes" />
              <button
                type="submit"
                className="focus-ring inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[#e6ded3] text-sm font-semibold text-[#173f3a]"
              >
                Marcar entregada
              </button>
            </form>
          ) : (
            <Link
              href={order.customer_id ? `/admin/customers/${order.customer_id}` : `/admin/orders/${order.id}`}
              className="focus-ring inline-flex h-10 items-center justify-center rounded-[10px] border border-[#e6ded3] text-sm font-semibold text-[#173f3a]"
            >
              Cliente
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

function MiniSummary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#e6ded3] bg-[#fffdf8] p-3">
      <div className="flex items-center gap-2 text-[#0f766e]">
        {icon}
        <p className="text-xs font-semibold text-[#716a63]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#171310]">{value}</p>
    </div>
  );
}

function DrawerSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-[#eee6dc] pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#171310]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 text-sm ${strong ? "font-semibold" : "text-[#716a63]"}`}>
      <span>{label}</span>
      <span className={strong ? "text-[#171310]" : ""}>{value}</span>
    </div>
  );
}

function matchesDashboardFilter(order: AdminDashboardOrder, filter: AdminOrderCountKey) {
  if (filter === "all") {
    return true;
  }

  if (filter === "attention") {
    return isDashboardOrderAttention(order);
  }

  if (filter === "to_prepare") {
    return isDashboardOrderToPrepare(order);
  }

  if (order.status === "cancelled" || order.fulfillment_status === "cancelled") {
    return filter === "cancelled";
  }

  if (order.fulfillment_status === "delivered" || order.status === "delivered") {
    return filter === "delivered";
  }

  if (order.fulfillment_status === "shipped" || order.status === "shipped") {
    return filter === "shipped";
  }

  if (order.fulfillment_status === "preparing" || order.status === "preparing") {
    return filter === "preparing";
  }

  return false;
}

function isDashboardOrderToPrepare(order: AdminDashboardOrder) {
  return (
    order.payment_status === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    order.fulfillment_status === "unfulfilled"
  );
}

function isDashboardOrderAttention(order: AdminDashboardOrder) {
  return (
    isDashboardOrderToPrepare(order) ||
    (order.payment_status === "paid" &&
      order.status !== "cancelled" &&
      order.status !== "refunded" &&
      order.fulfillment_status === "preparing" &&
      !order.shipment?.tracking_number)
  );
}

function getDelta(today: number, yesterday: number) {
  if (!yesterday && today) {
    return "Primeras ventas del día";
  }

  if (!yesterday) {
    return "Sin ventas ayer";
  }

  const percentage = Math.round(((today - yesterday) / yesterday) * 100);

  return `${percentage >= 0 ? "↑" : "↓"} ${Math.abs(percentage)}% vs ayer`;
}

function getDhlEstimate(value: string) {
  const start = addBusinessDays(new Date(value), 2);
  const end = addBusinessDays(new Date(value), 5);

  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

function addBusinessDays(date: Date, days: number) {
  const next = new Date(date);
  let added = 0;

  while (added < days) {
    next.setDate(next.getDate() + 1);
    const day = next.getDay();

    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return next;
}

function formatDayMonth(value: Date) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getNextStep(order: AdminDashboardOrder) {
  if (order.payment_status !== "paid") {
    return "Esperar pago";
  }

  if (order.fulfillment_status === "unfulfilled") {
    return "Marcar preparando";
  }

  if (order.fulfillment_status === "preparing" || order.fulfillment_status === "ready_to_ship") {
    return "Agregar guía";
  }

  if (order.fulfillment_status === "shipped") {
    return "Confirmar entrega";
  }

  return "Revisar";
}

"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  PackageCheck,
  Search,
  Send,
  Truck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { formatMoney } from "@/lib/money";
import type { AdminShippingCounts, AdminShippingRow } from "@/lib/admin/queries";
import type { AdminShippingView } from "@/lib/admin/operations";

import {
  markShippingDelivered,
  markShippingPreparing,
  retryShippingEmail,
  shipShippingOrder,
} from "./actions";

type ShippingOperationsCenterProps = {
  rows: AdminShippingRow[];
  allRows: AdminShippingRow[];
  counts: AdminShippingCounts;
  view: AdminShippingView;
  filters: {
    q?: string;
    product?: string;
    email?: string;
    carrier?: string;
    page: number;
    pageSize: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  settings: {
    carrierDisplayName: string;
    estimatedDelivery: string;
    prepareAttentionHours: number;
    shippingAttentionHours: number;
  };
  result: string;
  emailResult: string;
  reason: string;
  error?: string | null;
};

const viewTabs: Array<{ key: AdminShippingView; label: string }> = [
  { key: "attention", label: "Acción requerida" },
  { key: "to_prepare", label: "Por preparar" },
  { key: "preparing", label: "Preparando" },
  { key: "shipped", label: "En camino" },
  { key: "delivered", label: "Entregados" },
  { key: "all", label: "Todos" },
];

const resultMessages: Record<string, string> = {
  preparing: "Pedido movido a preparación.",
  shipped: "Guía registrada y pedido marcado en camino.",
  delivered: "Pedido marcado como entregado.",
  email_retry: "Reintento de email procesado.",
};

const errorMessages: Record<string, string> = {
  backend: "No se pudo conectar con el backend.",
  role: "Tu rol no permite esta acción.",
  confirm: "Confirma la acción antes de continuar.",
  order: "No se encontró la orden.",
  transition: "La orden no está en un estado válido para esa transición.",
  tracking: "La guía no tiene un formato válido.",
  duplicate: "La orden ya tenía una transición equivalente.",
  shipment: "No se pudo registrar el envío.",
  save: "No se pudo guardar el cambio.",
  event: "No se encontró el evento de email.",
  sent: "Ese email ya fue enviado y no se reintenta para evitar duplicados.",
  type: "El evento no corresponde a confirmación de envío.",
  context: "Falta contexto de envío para reintentar el email.",
};

export function ShippingOperationsCenter({
  rows,
  allRows,
  counts,
  view,
  filters,
  pagination,
  settings,
  result,
  emailResult,
  reason,
  error,
}: ShippingOperationsCenterProps) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id || null);
  const selectedRow = rows.find((row) => row.id === selectedId) || null;
  const productFilters = useMemo(
    () => uniqueOptions(allRows.map((row) => row.product_filter).filter(Boolean)),
    [allRows],
  );
  const emailFilters = useMemo(
    () => uniqueOptions(allRows.map((row) => row.email_status).filter(Boolean)),
    [allRows],
  );
  const carrierFilters = useMemo(
    () => uniqueOptions(allRows.map((row) => row.carrier).filter(Boolean)),
    [allRows],
  );

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e]">
            Operations Center
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#171310]">Envíos</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#716a63]">
            Prepara, despacha y da seguimiento a cada pedido.
          </p>
        </div>
        <SearchForm filters={filters} view={view} />
      </div>

      {error ? (
        <StatusNotice tone="error" message={error} />
      ) : result === "error" ? (
        <StatusNotice tone="error" message={errorMessages[reason] || "No se pudo completar la acción."} />
      ) : result ? (
        <StatusNotice
          tone="success"
          message={`${resultMessages[result] || "Acción completada."}${
            emailResult ? ` Email: ${emailResult}.` : ""
          }`}
        />
      ) : null}

      <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          href={shippingHref({ view: "to_prepare", filters })}
          label="Por preparar"
          value={counts.toPrepare}
          icon={PackageCheck}
          active={view === "to_prepare"}
        />
        <MetricCard
          href={shippingHref({ view: "preparing", filters })}
          label="Preparando"
          value={counts.preparing}
          icon={Clock3}
          active={view === "preparing"}
        />
        <MetricCard
          href={shippingHref({ view: "preparing", filters })}
          label="Sin guía"
          value={counts.needsGuide}
          icon={AlertTriangle}
          active={view === "preparing"}
          tone={counts.needsGuide ? "warning" : "neutral"}
        />
        <MetricCard
          href={shippingHref({ view: "shipped", filters })}
          label="En camino"
          value={counts.shipped}
          icon={Truck}
          active={view === "shipped"}
        />
        <MetricCard
          href={shippingHref({ view: "delivered", filters })}
          label="Entregados"
          value={counts.delivered}
          icon={CheckCircle2}
          active={view === "delivered"}
        />
        <MetricCard
          href={shippingHref({ view: "problems", filters })}
          label="Problemas"
          value={counts.problems}
          icon={AlertTriangle}
          active={view === "problems"}
          tone={counts.problems ? "danger" : "neutral"}
        />
      </section>

      <section className="surface mt-5 rounded-[8px] p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
            {viewTabs.map((tab) => (
              <Link
                key={tab.key}
                href={shippingHref({ view: tab.key, filters, page: 1 })}
                className={`focus-ring inline-flex h-10 shrink-0 items-center rounded-[8px] border px-3 text-xs font-semibold ${
                  view === tab.key
                    ? "border-[#171310] bg-[#171310] text-white"
                    : "border-[#e5dcd0] bg-white text-[#716a63] hover:text-[#171310]"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <FilterForm
            view={view}
            filters={filters}
            productFilters={productFilters}
            emailFilters={emailFilters}
            carrierFilters={carrierFilters}
          />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="surface min-w-0 overflow-hidden rounded-[8px]">
          <div className="border-b border-[#e8dfd5] px-4 py-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#171310]">Queue</h2>
                <p className="text-sm text-[#716a63]">
                  {pagination.total} pedidos · SLA preparar {settings.prepareAttentionHours}h · guía{" "}
                  {settings.shippingAttentionHours}h
                </p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f766e]">
                Orden: problemas → sin guía → por preparar
              </p>
            </div>
          </div>

          <div className="hidden max-w-full overflow-x-auto xl:block">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-[#e8dfd5] text-xs font-semibold uppercase tracking-[0.08em] text-[#716a63]">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Unidades</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Tiempo en estado</th>
                  <th className="px-4 py-3">Guía</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[#f0e8de] last:border-0 ${
                      selectedId === row.id ? "bg-[#f6f1e9]" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="focus-ring text-left font-semibold text-[#0f766e] hover:underline"
                      >
                        {row.order_number}
                      </button>
                      <p className="mt-1 text-xs text-[#716a63]">{formatMoney(row.total_cents, row.currency)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.customer_id ? (
                        <Link
                          className="font-semibold text-[#171310] hover:text-[#0f766e] hover:underline"
                          href={`/admin/customers/${row.customer_id}`}
                        >
                          {row.customer_name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-[#171310]">{row.customer_name}</p>
                      )}
                      <p className="mt-1 max-w-[180px] truncate text-xs text-[#716a63]">{row.customer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ProductSummary row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-lg font-semibold text-[#171310]">{row.physical_units}</p>
                      <p className="text-xs text-[#716a63]">físicas</p>
                    </td>
                    <td className="px-4 py-3">
                      <FulfillmentBadge row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#171310]">{row.time_in_state}</p>
                      <p className="mt-1 text-xs text-[#716a63]">{formatDate(row.state_started_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TrackingValue row={row} />
                    </td>
                    <td className="px-4 py-3">
                      <EmailStatus status={row.email_status} />
                    </td>
                    <td className="px-4 py-3">
                      <QueueAction row={row} onOpen={() => setSelectedId(row.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 xl:hidden">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-[8px] border border-[#eadfce] bg-white p-4"
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className="focus-ring block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0f766e]">{row.order_number}</p>
                      <p className="mt-1 text-sm font-semibold text-[#171310]">{row.customer_name}</p>
                      <p className="mt-1 text-xs text-[#716a63]">{row.product_label}</p>
                    </div>
                    <FulfillmentBadge row={row} />
                  </div>
                </button>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <MiniStat label="Unidades" value={String(row.physical_units)} />
                  <MiniStat label="Tiempo" value={row.time_in_state} />
                  <MiniStat label="Email" value={emailLabel(row.email_status)} />
                </div>
                {row.problem_labels.length ? (
                  <p className="mt-3 text-xs font-semibold text-[#9a392b]">
                    {row.problem_labels.join(" · ")}
                  </p>
                ) : null}
                <div className="mt-4">
                  <QueueAction row={row} onOpen={() => setSelectedId(row.id)} />
                </div>
              </article>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-semibold text-[#171310]">No hay pedidos en esta vista.</p>
              <p className="mt-1 text-sm text-[#716a63]">
                Ajusta búsqueda o filtros para revisar otra parte de la operación.
              </p>
            </div>
          ) : null}

          <Pagination pagination={pagination} filters={filters} view={view} />
        </div>

        <OrderDrawer
          row={selectedRow}
          settings={settings}
          onClose={() => setSelectedId(null)}
        />
      </section>
    </main>
  );
}

function SearchForm({
  filters,
  view,
}: {
  filters: ShippingOperationsCenterProps["filters"];
  view: AdminShippingView;
}) {
  return (
    <form action="/admin/shipping" className="flex w-full gap-2 sm:max-w-md">
      <input type="hidden" name="view" value={view} />
      <label className="relative min-w-0 flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#716a63]"
          aria-hidden
        />
        <span className="sr-only">Buscar envíos</span>
        <input
          name="q"
          defaultValue={filters.q || ""}
          className="focus-ring h-11 w-full rounded-[8px] border border-[#e4dbcf] bg-white pl-10 pr-3 text-sm font-semibold text-[#171310]"
          placeholder="Pedido, cliente o guía"
        />
      </label>
      <button
        type="submit"
        className="focus-ring inline-flex h-11 items-center rounded-[8px] bg-[#0f766e] px-4 text-sm font-semibold text-white"
      >
        Buscar
      </button>
    </form>
  );
}

function FilterForm({
  view,
  filters,
  productFilters,
  emailFilters,
  carrierFilters,
}: {
  view: AdminShippingView;
  filters: ShippingOperationsCenterProps["filters"];
  productFilters: string[];
  emailFilters: string[];
  carrierFilters: string[];
}) {
  return (
    <form action="/admin/shipping" className="grid gap-2 sm:grid-cols-4 xl:w-auto">
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="q" value={filters.q || ""} />
      <Select name="product" label="Producto" value={filters.product || "all"} options={productFilters} />
      <Select name="email" label="Email" value={filters.email || "all"} options={emailFilters} />
      <Select name="carrier" label="Carrier" value={filters.carrier || "all"} options={carrierFilters} />
      <select
        name="pageSize"
        defaultValue={String(filters.pageSize)}
        className="focus-ring h-10 rounded-[8px] border border-[#e4dbcf] bg-white px-3 text-xs font-semibold text-[#171310]"
        aria-label="Tamaño de página"
      >
        <option value="25">25 filas</option>
        <option value="50">50 filas</option>
      </select>
      <button className="sr-only" type="submit">
        Aplicar filtros
      </button>
    </form>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="focus-ring h-10 w-full rounded-[8px] border border-[#e4dbcf] bg-white px-3 text-xs font-semibold text-[#171310]"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="all">{label}: todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {label}: {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({
  href,
  label,
  value,
  icon: Icon,
  active,
  tone = "neutral",
}: {
  href: string;
  label: string;
  value: number;
  icon: typeof Truck;
  active: boolean;
  tone?: "neutral" | "warning" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-[#9a392b]"
      : tone === "warning"
        ? "text-[#7b6418]"
        : "text-[#0f766e]";

  return (
    <Link
      href={href}
      className={`focus-ring rounded-[8px] border p-4 transition ${
        active ? "border-[#0f766e] bg-[#e8f4f1]" : "border-[#eadfce] bg-white hover:border-[#c7bfb5]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#716a63]">{label}</p>
        <Icon size={17} className={color} aria-hidden />
      </div>
      <p className="mt-4 text-3xl font-semibold text-[#171310]">{value}</p>
    </Link>
  );
}

function OrderDrawer({
  row,
  settings,
  onClose,
}: {
  row: AdminShippingRow | null;
  settings: ShippingOperationsCenterProps["settings"];
  onClose: () => void;
}) {
  if (!row) {
    return (
      <aside className="surface hidden rounded-[8px] p-5 xl:block">
        <p className="font-semibold text-[#171310]">Selecciona un pedido</p>
        <p className="mt-2 text-sm text-[#716a63]">
          El detalle operativo aparece aquí sin salir de la queue.
        </p>
      </aside>
    );
  }

  return (
    <aside className="surface fixed inset-0 z-50 overflow-y-auto bg-[#fffdf8] p-5 xl:sticky xl:top-24 xl:z-0 xl:max-h-[calc(100vh-7rem)] xl:rounded-[8px] xl:border xl:border-[#eadfce]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e]">Pedido</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#171310]">{row.order_number}</h2>
          <p className="mt-1 text-sm text-[#716a63]">{formatMoney(row.total_cents, row.currency)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#e4dbcf] bg-white text-[#171310]"
          aria-label="Cerrar detalle"
        >
          <X size={17} aria-hidden />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <MiniStat label="Packs" value={String(row.packs)} />
        <MiniStat label="Unidades físicas" value={String(row.physical_units)} />
        <MiniStat label="Estado" value={statusLabel(row.fulfillment_status)} />
        <MiniStat label="Tiempo" value={row.time_in_state} />
      </div>

      <DrawerSection title="Cliente">
        {row.customer_id ? (
          <Link
            href={`/admin/customers/${row.customer_id}`}
            className="font-semibold text-[#0f766e] hover:underline"
          >
            {row.customer_name}
          </Link>
        ) : (
          <p className="font-semibold text-[#171310]">{row.customer_name}</p>
        )}
        <p className="mt-1 text-sm text-[#716a63]">{row.customer_email}</p>
        <p className="text-sm text-[#716a63]">{row.customer_phone || "Sin teléfono"}</p>
        <div className="mt-3 rounded-[8px] border border-[#eadfce] bg-white p-3 text-sm text-[#716a63]">
          {row.address_lines.length ? (
            row.address_lines.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p>Sin dirección capturada</p>
          )}
        </div>
      </DrawerSection>

      <DrawerSection title="Productos">
        <ProductSummary row={row} />
        <p className="mt-3 text-sm text-[#716a63]">
          Quantity: {row.packs} {row.packs === 1 ? "pack" : "packs"} · Physical: {row.physical_units}{" "}
          Luzela{row.physical_units === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-sm font-semibold text-[#171310]">
          Total: {formatMoney(row.total_cents, row.currency)}
        </p>
      </DrawerSection>

      <DrawerSection title="Envío">
        <div className="grid gap-2 text-sm">
          <p>
            <span className="font-semibold text-[#171310]">Carrier:</span>{" "}
            <span className="text-[#716a63]">{row.carrier || settings.carrierDisplayName}</span>
          </p>
          <p>
            <span className="font-semibold text-[#171310]">Entrega estimada:</span>{" "}
            <span className="text-[#716a63]">{row.estimated_delivery}</span>
          </p>
          <TrackingValue row={row} />
          <EmailStatus status={row.email_status} />
        </div>
      </DrawerSection>

      {row.problem_labels.length ? (
        <DrawerSection title="Atención">
          <div className="grid gap-2">
            {row.problem_labels.map((problem, index) => (
              <div key={problem} className="rounded-[8px] border border-[#f1d1c8] bg-[#fff7f4] p-3">
                <p className="text-sm font-semibold text-[#9a392b]">{problem}</p>
                <p className="mt-1 text-xs text-[#716a63]">{row.problem_actions[index]}</p>
              </div>
            ))}
          </div>
        </DrawerSection>
      ) : null}

      <DrawerSection title="Acciones">
        <div className="grid gap-3">
          {row.fulfillment_status === "unfulfilled" ? <PrepareForm row={row} /> : null}
          {row.fulfillment_status === "preparing" || row.fulfillment_status === "ready_to_ship" ? (
            <ShipForm row={row} />
          ) : null}
          {row.fulfillment_status === "shipped" ? <DeliveredForm row={row} /> : null}
          {canRetryShippingEmail(row) ? <RetryEmailForm row={row} /> : null}
          <div className="rounded-[8px] border border-[#eadfce] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#716a63]">Cancelación</p>
            <p className="mt-1 text-sm text-[#716a63]">
              Las cancelaciones se revisan desde el detalle de orden para no mezclar fulfillment con pagos.
            </p>
            <Link
              href={`/admin/orders/${row.id}`}
              className="focus-ring mt-3 inline-flex h-9 items-center rounded-[8px] border border-[#171310] px-3 text-xs font-semibold text-[#171310]"
            >
              Abrir orden
            </Link>
          </div>
        </div>
      </DrawerSection>

      <DrawerSection title="Timeline">
        <ol className="grid gap-3">
          {row.timeline.map((item) => (
            <li key={item.label} className="grid grid-cols-[12px_minmax(0,1fr)] gap-3">
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  item.at ? "bg-[#0f766e]" : "bg-[#d8cec0]"
                }`}
                aria-hidden
              />
              <div>
                <p className="text-sm font-semibold text-[#171310]">{item.label}</p>
                <p className="text-xs text-[#716a63]">{item.at ? formatDate(item.at) : "Pendiente"}</p>
              </div>
            </li>
          ))}
        </ol>
      </DrawerSection>
    </aside>
  );
}

function PrepareForm({ row }: { row: AdminShippingRow }) {
  const action = markShippingPreparing.bind(null, row.id);

  return (
    <details className="rounded-[8px] border border-[#eadfce] bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-[#171310]">Comenzar preparación</summary>
      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="confirm" value="yes" />
        <p className="text-sm text-[#716a63]">
          Confirma que el pedido pagado entra a mesa de preparación.
        </p>
        <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0f766e] px-3 text-sm font-semibold text-white">
          <PackageCheck size={16} aria-hidden /> Preparar
        </button>
      </form>
    </details>
  );
}

function ShipForm({ row }: { row: AdminShippingRow }) {
  const action = shipShippingOrder.bind(null, row.id);

  return (
    <details className="rounded-[8px] border border-[#eadfce] bg-white p-3" open={!row.tracking_number}>
      <summary className="cursor-pointer text-sm font-semibold text-[#171310]">
        Agregar guía y enviar
      </summary>
      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="confirm" value="yes" />
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#716a63]">
            Guía DHL
          </span>
          <input
            name="tracking_number"
            defaultValue={row.tracking_number}
            className="focus-ring h-10 rounded-[8px] border border-[#e4dbcf] bg-white px-3 text-sm font-semibold text-[#171310]"
            placeholder="Número de guía"
            required
          />
        </label>
        <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#0f766e] px-3 text-sm font-semibold text-white">
          <Send size={16} aria-hidden /> Confirmar envío
        </button>
      </form>
    </details>
  );
}

function DeliveredForm({ row }: { row: AdminShippingRow }) {
  const action = markShippingDelivered.bind(null, row.id);

  return (
    <details className="rounded-[8px] border border-[#eadfce] bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-[#171310]">Marcar entregado</summary>
      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="confirm" value="yes" />
        <p className="text-sm text-[#716a63]">
          Confirma que la guía ya fue entregada antes de cerrar el pedido.
        </p>
        <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#171310] px-3 text-sm font-semibold text-white">
          <CheckCircle2 size={16} aria-hidden /> Entregado
        </button>
      </form>
    </details>
  );
}

function RetryEmailForm({ row }: { row: AdminShippingRow }) {
  const action = retryShippingEmail.bind(null, row.id, row.email_event_id || "");

  return (
    <form action={action} className="rounded-[8px] border border-[#f1d1c8] bg-[#fff7f4] p-3">
      <p className="text-sm font-semibold text-[#171310]">Reintentar email de envío</p>
      <p className="mt-1 text-xs text-[#716a63]">
        Solo disponible para eventos failed/skipped. Si ya está sent, el backend lo bloquea.
      </p>
      <button className="focus-ring mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#9a392b] px-3 text-sm font-semibold text-[#9a392b]">
        <Mail size={16} aria-hidden /> Reintentar
      </button>
    </form>
  );
}

function QueueAction({ row, onOpen }: { row: AdminShippingRow; onOpen: () => void }) {
  const label =
    row.problem_labels.length > 0
      ? "Resolver"
      : row.fulfillment_status === "unfulfilled"
        ? "Preparar"
        : row.fulfillment_status === "preparing" || row.fulfillment_status === "ready_to_ship"
          ? "Guía"
          : row.fulfillment_status === "shipped"
            ? "Entregar"
            : "Ver";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring inline-flex h-9 items-center gap-1 rounded-[8px] border border-[#171310] px-3 text-xs font-semibold text-[#171310]"
    >
      {label} <ArrowRight size={14} aria-hidden />
    </button>
  );
}

function ProductSummary({ row }: { row: AdminShippingRow }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#eadfce] bg-white">
        <Image
          src="/luzela/bottle.webp"
          alt=""
          aria-hidden
          width={32}
          height={48}
          className="h-10 w-auto object-contain"
        />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#171310]">{row.product_label}</p>
        <p className="mt-1 text-xs text-[#716a63]">{row.product_subline}</p>
      </div>
    </div>
  );
}

function FulfillmentBadge({ row }: { row: AdminShippingRow }) {
  const hasProblem = row.problem_labels.length > 0;
  const classes = hasProblem
    ? "border-[#f1d1c8] bg-[#fff0ec] text-[#9a392b]"
    : row.fulfillment_status === "delivered"
      ? "border-[#cce8d7] bg-[#e7f5ec] text-[#1f6b43]"
      : row.fulfillment_status === "shipped"
        ? "border-[#d8e8fb] bg-[#eef5ff] text-[#315f8f]"
        : row.fulfillment_status === "preparing" || row.fulfillment_status === "ready_to_ship"
          ? "border-[#efe3a8] bg-[#fff9db] text-[#7b6418]"
          : "border-[#e4dbcf] bg-[#faf7f1] text-[#716a63]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      {hasProblem ? "PROBLEMA" : statusLabel(row.fulfillment_status).toUpperCase()}
    </span>
  );
}

function TrackingValue({ row }: { row: AdminShippingRow }) {
  if (!row.tracking_number) {
    return <span className="text-sm text-[#716a63]">Sin guía</span>;
  }

  if (!row.tracking_url) {
    return <span className="text-sm font-semibold text-[#171310]">{row.tracking_number}</span>;
  }

  return (
    <a
      className="focus-ring text-sm font-semibold text-[#0f766e] hover:underline"
      href={row.tracking_url}
      target="_blank"
      rel="noreferrer"
    >
      {row.tracking_number}
    </a>
  );
}

function EmailStatus({ status }: { status: string }) {
  const palette =
    status === "sent"
      ? "border-[#cce8d7] bg-[#e7f5ec] text-[#1f6b43]"
      : status === "failed"
        ? "border-[#f1d1c8] bg-[#fff0ec] text-[#9a392b]"
        : status === "skipped"
          ? "border-[#efe3a8] bg-[#fff9db] text-[#7b6418]"
          : "border-[#d8e8fb] bg-[#eef5ff] text-[#315f8f]";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${palette}`}>
      {emailLabel(status)}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#eadfce] bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#716a63]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#171310]">{value}</p>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-[#eadfce] pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#716a63]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function StatusNotice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes =
    tone === "success"
      ? "border-[#cce8d7] bg-[#f0faf4] text-[#1f6b43]"
      : "border-[#f1d1c8] bg-[#fff0ec] text-[#9a392b]";

  return <div className={`mt-5 rounded-[8px] border p-4 text-sm font-semibold ${classes}`}>{message}</div>;
}

function Pagination({
  pagination,
  filters,
  view,
}: {
  pagination: ShippingOperationsCenterProps["pagination"];
  filters: ShippingOperationsCenterProps["filters"];
  view: AdminShippingView;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#e8dfd5] px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[#716a63]">
        Página {pagination.page} de {pagination.totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={shippingHref({ view, filters, page: Math.max(1, pagination.page - 1) })}
          aria-disabled={pagination.page === 1}
          className={`focus-ring rounded-[8px] border px-3 py-2 text-xs font-semibold ${
            pagination.page === 1
              ? "pointer-events-none border-[#eadfce] text-[#b6ada1]"
              : "border-[#171310] text-[#171310]"
          }`}
        >
          Anterior
        </Link>
        <Link
          href={shippingHref({ view, filters, page: Math.min(pagination.totalPages, pagination.page + 1) })}
          aria-disabled={pagination.page === pagination.totalPages}
          className={`focus-ring rounded-[8px] border px-3 py-2 text-xs font-semibold ${
            pagination.page === pagination.totalPages
              ? "pointer-events-none border-[#eadfce] text-[#b6ada1]"
              : "border-[#171310] text-[#171310]"
          }`}
        >
          Siguiente
        </Link>
      </div>
    </div>
  );
}

function shippingHref({
  view,
  filters,
  page,
}: {
  view: AdminShippingView;
  filters: ShippingOperationsCenterProps["filters"];
  page?: number;
}) {
  const params = new URLSearchParams();

  params.set("view", view);
  if (filters.q) params.set("q", filters.q);
  if (filters.product && filters.product !== "all") params.set("product", filters.product);
  if (filters.email && filters.email !== "all") params.set("email", filters.email);
  if (filters.carrier && filters.carrier !== "all") params.set("carrier", filters.carrier);
  params.set("page", String(page || filters.page || 1));
  params.set("pageSize", String(filters.pageSize || 25));

  return `/admin/shipping?${params.toString()}`;
}

function uniqueOptions(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es-MX"));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    unfulfilled: "Por preparar",
    preparing: "Preparando",
    ready_to_ship: "Listo para enviar",
    shipped: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

  return labels[status] || status;
}

function emailLabel(status: string) {
  const labels: Record<string, string> = {
    sent: "Sent",
    failed: "Failed",
    skipped: "Skipped",
    pending: "Pending",
    none: "Sin evento",
  };

  return labels[status] || status;
}

function canRetryShippingEmail(row: AdminShippingRow) {
  return Boolean(
    row.email_event_id &&
      (row.email_status === "failed" || row.email_status === "skipped") &&
      row.fulfillment_status === "shipped",
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getAdminOrderDetail } from "@/lib/admin/queries";
import { getDhlTrackingUrl } from "@/lib/fulfillment/dhl";
import { formatMoney } from "@/lib/money";

import { markOrderShipped } from "./actions";

type OrderItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  units_per_pack?: number | null;
  physical_units?: number | null;
  subtotal_cents: number;
};

type InventoryMovement = {
  id: string;
  movement_type: string;
  quantity_delta: number;
  reason: string | null;
  metadata?: {
    pack_quantity?: number;
    units_per_pack?: number;
    physical_units?: number;
  } | null;
};

type PaymentEvent = {
  id: string;
  event_type: string;
  processed_at: string | null;
  created_at: string;
};

type Shipment = {
  id: string;
  carrier: string | null;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
};

type EmailEvent = {
  id: string;
  template_key: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderId } = await params;
  const query = searchParams ? await searchParams : {};
  const { order, movements, events, emailEvents, error } =
    await getAdminOrderDetail(orderId);
  const customer = Array.isArray(order?.customers)
    ? order?.customers[0]
    : order?.customers;
  const address = Array.isArray(order?.customer_addresses)
    ? order?.customer_addresses[0]
    : order?.customer_addresses;
  const items: OrderItem[] = Array.isArray(order?.order_items)
    ? order?.order_items
    : [];
  const payments = Array.isArray(order?.payments) ? order?.payments : [];
  const shipments: Shipment[] = Array.isArray(order?.shipments)
    ? order?.shipments
    : [];
  const shipment = shipments[0];
  const inventoryMovements = movements as InventoryMovement[];
  const paymentEvents = (events || []) as PaymentEvent[];
  const shippingEmailEvents = ((emailEvents || []) as EmailEvent[]).filter(
    (event) => event.template_key === "order_shipped",
  );
  const latestShippingEmail = shippingEmailEvents[0];
  const canMarkShipped =
    order?.payment_status === "paid" &&
    order?.status !== "cancelled" &&
    order?.status !== "refunded" &&
    order?.fulfillment_status !== "cancelled" &&
    order?.fulfillment_status !== "shipped" &&
    order?.fulfillment_status !== "delivered" &&
    !shipment;
  const shippingStatus = String(query.shipping || "");
  const shippingReason = String(query.reason || "");
  const emailStatus = String(query.email || latestShippingEmail?.status || "");

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
        <ArrowLeft size={16} aria-hidden />
        Orders
      </Link>

      {error ? (
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-white p-4 text-sm font-semibold text-[var(--coral)]">
          {error}
        </div>
      ) : null}

      {!order ? (
        <section className="surface mt-6 rounded-[8px] p-5">Orden no encontrada.</section>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
                Order detail
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{order.order_number}</h1>
            </div>
            <p className="text-lg font-semibold">
              {formatMoney(order.total_cents, order.currency)}
            </p>
          </div>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="grid gap-5">
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="mt-4 grid gap-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {item.sku} x {item.quantity} pack{item.quantity === 1 ? "" : "s"}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {item.units_per_pack || 1} Luzela{(item.units_per_pack || 1) === 1 ? "" : "s"} por pack · {item.physical_units || item.quantity} unidades físicas
                        </p>
                      </div>
                      <p>{formatMoney(item.subtotal_cents, order.currency)}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">Inventory movement</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  {inventoryMovements.map((movement) => (
                    <div key={movement.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                      <p className="font-semibold">
                        {movement.movement_type} {movement.quantity_delta}
                      </p>
                      <p className="text-[var(--muted)]">{movement.reason}</p>
                      {movement.metadata?.physical_units ? (
                        <p className="text-[var(--muted)]">
                          {movement.metadata.pack_quantity || 1} pack{movement.metadata.pack_quantity === 1 ? "" : "s"} · {movement.metadata.units_per_pack || 1} por pack · {movement.metadata.physical_units} unidades físicas
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {inventoryMovements.length === 0 ? <p className="text-[var(--muted)]">Sin movimientos para esta orden.</p> : null}
                </div>
              </article>

              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">Timeline</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  {paymentEvents.map((event) => (
                    <div key={event.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                      <p className="font-semibold">{event.event_type}</p>
                      <p className="text-[var(--muted)]">
                        {event.processed_at
                          ? `Processed ${new Date(event.processed_at).toLocaleString("es-MX")}`
                          : `Received ${new Date(event.created_at).toLocaleString("es-MX")}`}
                      </p>
                    </div>
                  ))}
                  {paymentEvents.length === 0 ? (
                    <p className="text-[var(--muted)]">Sin eventos de pago para esta orden.</p>
                  ) : null}
                </div>
              </article>
            </div>

            <aside className="grid h-fit gap-5">
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">ENVÍO</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-[var(--muted)]">Carrier</dt>
                    <dd className="font-semibold">DHL</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Estado</dt>
                    <dd className="font-semibold">
                      {shipment ? shipment.status.toUpperCase() : order.fulfillment_status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Guía</dt>
                    <dd className="break-all font-semibold">
                      {shipment?.tracking_number || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Fecha de envío</dt>
                    <dd className="font-semibold">
                      {shipment?.shipped_at
                        ? new Date(shipment.shipped_at).toLocaleString("es-MX")
                        : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Tracking</dt>
                    <dd>
                      <a
                        className="font-semibold text-[var(--teal)] underline-offset-4 hover:underline"
                        href={shipment?.tracking_url || getDhlTrackingUrl()}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Portal oficial DHL
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Notificación</dt>
                    <dd className="font-semibold">
                      {emailStatus === "sent"
                        ? "Enviada al cliente"
                        : emailStatus === "failed"
                        ? "Error al enviar"
                        : emailStatus === "skipped"
                        ? "No enviada (Resend sin configurar)"
                        : "Pendiente"}
                    </dd>
                  </div>
                </dl>

                {shippingStatus === "shipped" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--teal)]">
                    Envío registrado correctamente.
                  </p>
                ) : null}
                {shippingStatus === "error" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--coral)]">
                    {getShippingErrorMessage(shippingReason)}
                  </p>
                ) : null}

                {canMarkShipped ? (
                  <form action={markOrderShipped.bind(null, order.id)} className="mt-5 grid gap-3">
                    <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                      Número de guía DHL
                      <input
                        name="tracking_number"
                        required
                        minLength={5}
                        className="focus-ring h-11 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm font-semibold uppercase"
                        placeholder="XXXXXXXXXX"
                      />
                    </label>
                    <button
                      type="submit"
                      className="focus-ring inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
                    >
                      Marcar como enviado
                    </button>
                  </form>
                ) : shipment ? (
                  <p className="mt-4 text-sm font-semibold text-[var(--teal)]">ENVIADO</p>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    El control aparece cuando la orden está pagada y puede enviarse.
                  </p>
                )}
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">Customer</h2>
                <p className="mt-3 text-sm">{customer?.email}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{customer?.phone}</p>
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">Address</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {address?.line1}
                  <br />
                  {address?.neighborhood}
                  <br />
                  {address?.city}, {address?.state} {address?.postal_code}
                </p>
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">Pago</h2>
                <dl className="mt-3 grid gap-3 text-sm">
                  <div>
                    <dt className="text-[var(--muted)]">Provider</dt>
                    <dd className="break-all font-semibold">{order.payment_provider || payments[0]?.provider || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Provider Order</dt>
                    <dd className="break-all font-semibold">{order.provider_order_id || payments[0]?.provider_order_id || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Provider Payment</dt>
                    <dd className="break-all font-semibold">{order.provider_payment_id || payments[0]?.provider_payment_id || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Checkout Session</dt>
                    <dd className="break-all font-semibold">{order.stripe_checkout_session_id || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Payment Intent</dt>
                    <dd className="break-all font-semibold">{order.stripe_payment_intent_id || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Payment rows</dt>
                    <dd className="font-semibold">{payments.length}</dd>
                  </div>
                </dl>
              </article>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

function getShippingErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    backend: "Backend no configurado para registrar envíos.",
    duplicate: "Esta orden ya tiene un envío registrado.",
    order: "Orden no encontrada.",
    role: "Tu rol no permite marcar envíos.",
    shipment: "No se pudo registrar el envío.",
    tracking: "Ingresa una guía DHL válida.",
    transition: "Esta orden no puede marcarse como enviada.",
  };

  return messages[reason] || "No se pudo registrar el envío.";
}

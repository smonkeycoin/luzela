import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getAdminOrderDetail } from "@/lib/admin/queries";
import { getDhlTrackingUrl } from "@/lib/fulfillment/dhl";
import { canMarkDelivered, canMarkPreparing } from "@/lib/admin/operations";
import { formatMoney } from "@/lib/money";
import { getShippingPolicy } from "@/lib/settings";

import {
  markOrderDelivered,
  markOrderPreparing,
  markOrderShipped,
  reconcileMercadoPagoOrder,
  retryTransactionalEmail,
} from "./actions";

type OrderItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  units_per_pack?: number | null;
  physical_units?: number | null;
  unit_price_cents: number;
  subtotal_cents: number;
  metadata?: {
    original_price_cents?: number;
    offer_price_cents?: number | null;
    offer_active?: boolean;
    effective_price_cents?: number;
  } | null;
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
  delivered_at: string | null;
};

type EmailEvent = {
  id: string;
  template_key: string;
  event_type?: string | null;
  recipient?: string | null;
  status: string;
  provider?: string | null;
  provider_message_id?: string | null;
  attempt_count?: number | null;
  last_attempt_at?: string | null;
  error_code?: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at?: string | null;
};

type AuditEvent = {
  id: string;
  action: string;
  created_at: string;
  after_data?: Record<string, unknown> | null;
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
  const [orderDetail, shippingPolicy] = await Promise.all([
    getAdminOrderDetail(orderId),
    getShippingPolicy(),
  ]);
  const { order, movements, events, emailEvents, auditEvents, attribution, error } = orderDetail;
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
  const auditTrail = (auditEvents || []) as AuditEvent[];
  const allEmailEvents = (emailEvents || []) as EmailEvent[];
  const shippingEmailEvents = allEmailEvents.filter(
    (event) => getEmailEventType(event) === "SHIPPING_CONFIRMATION",
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
  const canPrepare = order ? canMarkPreparing(order) : false;
  const canDeliver = order ? canMarkDelivered(order) && Boolean(shipment) : false;
  const canReconcilePayment =
    order?.payment_provider === "mercadopago" &&
    order?.payment_status !== "paid" &&
    Boolean(order?.provider_order_id || payments[0]?.provider_order_id);
  const shippingStatus = String(query.shipping || "");
  const shippingReason = String(query.reason || "");
  const emailStatus = String(query.email || latestShippingEmail?.status || "");
  const fulfillmentStatus = String(query.fulfillment || "");
  const fulfillmentReason = String(query.reason || "");
  const paymentStatus = String(query.payment || "");
  const paymentReason = String(query.reason || "");

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
                ORDER
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{order.order_number}</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Creada {new Date(order.created_at).toLocaleString("es-MX")} · Payment {order.payment_status} · Fulfillment {order.fulfillment_status}
              </p>
            </div>
            <p className="text-lg font-semibold">
              {formatMoney(order.total_cents, order.currency)}
            </p>
          </div>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="grid gap-5">
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">ITEMS</h2>
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
                        {(item.physical_units || item.quantity) >= 10 ? (
                          <p className="mt-2 inline-flex border border-[var(--teal)]/30 bg-[var(--background)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
                            UNIDADES A PREPARAR: {item.physical_units || item.quantity}
                          </p>
                        ) : null}
                        <p className="text-sm text-[var(--muted)]">
                          Precio pack {formatMoney(item.unit_price_cents, order.currency)}
                        </p>
                        {item.metadata?.offer_active ? (
                          <p className="text-sm text-[var(--muted)]">
                            Precio original:{" "}
                            <span className="line-through">
                              {formatMoney(item.metadata.original_price_cents || 0, order.currency)}
                            </span>{" "}
                            · Precio de venta:{" "}
                            <span className="font-semibold text-[var(--teal)]">
                              {formatMoney(
                                item.metadata.effective_price_cents || item.unit_price_cents,
                                order.currency,
                              )}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <p>{formatMoney(item.subtotal_cents, order.currency)}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">INVENTORY</h2>
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
                <h2 className="text-lg font-semibold">TIMELINE</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="border-b border-[var(--line)] pb-3">
                    <p className="font-semibold">orden creada</p>
                    <p className="text-[var(--muted)]">
                      {new Date(order.created_at).toLocaleString("es-MX")}
                    </p>
                  </div>
                  {order.paid_at ? (
                    <div className="border-b border-[var(--line)] pb-3">
                      <p className="font-semibold">pago confirmado</p>
                      <p className="text-[var(--muted)]">
                        {new Date(order.paid_at).toLocaleString("es-MX")}
                      </p>
                    </div>
                  ) : null}
                  {inventoryMovements.map((movement) => (
                    <div key={`timeline-${movement.id}`} className="border-b border-[var(--line)] pb-3">
                      <p className="font-semibold">inventario descontado / movimiento {movement.movement_type}</p>
                      <p className="text-[var(--muted)]">{movement.quantity_delta} unidades físicas</p>
                    </div>
                  ))}
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
                  {auditTrail.map((event) => (
                    <div key={event.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                      <p className="font-semibold">{event.action}</p>
                      <p className="text-[var(--muted)]">
                        {new Date(event.created_at).toLocaleString("es-MX")}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <aside className="grid h-fit gap-5">
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">FULFILLMENT</h2>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-[var(--muted)]">Carrier</dt>
                    <dd className="font-semibold">
                      {shipment?.carrier || shippingPolicy.carrierDisplayName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Estimado</dt>
                    <dd className="font-semibold">
                      {shippingPolicy.minDays} a {shippingPolicy.maxDays}{" "}
                      {shippingPolicy.businessDays ? "días hábiles" : "días"}
                    </dd>
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
                        Portal oficial {shippingPolicy.carrierDisplayName}
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
                {shippingStatus === "shipped" && emailStatus === "sent" ? (
                  <p className="mt-3 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--teal)]">
                    Notificación enviada al cliente.
                  </p>
                ) : null}
                {shippingStatus === "shipped" && emailStatus === "failed" ? (
                  <p className="mt-3 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--coral)]">
                    Envío registrado. La notificación por correo falló.
                  </p>
                ) : null}
                {shippingStatus === "error" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--coral)]">
                    {getShippingErrorMessage(shippingReason)}
                  </p>
                ) : null}
                {fulfillmentStatus === "preparing" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--teal)]">
                    Orden marcada como preparando.
                  </p>
                ) : null}
                {fulfillmentStatus === "delivered" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--teal)]">
                    Orden marcada como entregada.
                  </p>
                ) : null}
                {fulfillmentStatus === "error" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--coral)]">
                    {getFulfillmentErrorMessage(fulfillmentReason)}
                  </p>
                ) : null}

                {canPrepare ? (
                  <form action={markOrderPreparing.bind(null, order.id)} className="mt-5 grid gap-3">
                    <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                      <input name="confirm" type="checkbox" value="yes" className="mt-1" />
                      Confirmo iniciar preparación. No cambia payment status.
                    </label>
                    <button
                      type="submit"
                      className="focus-ring inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink)]"
                    >
                      Marcar preparando
                    </button>
                  </form>
                ) : null}

                {canMarkShipped ? (
                  <form action={markOrderShipped.bind(null, order.id)} className="mt-5 grid gap-3">
                    <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                      Número de guía {shippingPolicy.carrierDisplayName}
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
                  <p className="mt-4 text-sm font-semibold text-[var(--teal)]">
                    {shipment.delivered_at ? "ENTREGADO" : "ENVIADO"}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    El control aparece cuando la orden está pagada y puede enviarse.
                  </p>
                )}

                {canDeliver ? (
                  <form action={markOrderDelivered.bind(null, order.id)} className="mt-5 grid gap-3">
                    <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                      <input name="confirm" type="checkbox" value="yes" className="mt-1" />
                      Confirmo que {shippingPolicy.carrierDisplayName} entregó esta orden.
                    </label>
                    <button
                      type="submit"
                      className="focus-ring inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink)]"
                    >
                      Marcar como entregada
                    </button>
                  </form>
                ) : null}
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">CUSTOMER</h2>
                <p className="mt-3 text-sm">
                  {[customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "-"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{customer?.email}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{customer?.phone}</p>
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">SHIPPING ADDRESS</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {address?.full_name}
                  <br />
                  {address?.line1}
                  <br />
                  {address?.line2 ? (
                    <>
                      {address.line2}
                      <br />
                    </>
                  ) : null}
                  {address?.neighborhood}
                  <br />
                  {address?.city}, {address?.state} {address?.postal_code}
                  <br />
                  {address?.country}
                </p>
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">PAYMENT</h2>
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
                    <dt className="text-[var(--muted)]">Paid at</dt>
                    <dd className="break-all font-semibold">
                      {order.paid_at ? new Date(order.paid_at).toLocaleString("es-MX") : "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted)]">Stripe Checkout Session</dt>
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
                {paymentStatus === "reconciled" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--teal)]">
                    Pago verificado con Mercado Pago y conciliado.
                  </p>
                ) : null}
                {paymentStatus === "not_paid" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--muted)]">
                    Mercado Pago todavía no reporta pago acreditado.
                  </p>
                ) : null}
                {paymentStatus === "error" ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--coral)]">
                    {getPaymentErrorMessage(paymentReason)}
                  </p>
                ) : null}
                {canReconcilePayment ? (
                  <form action={reconcileMercadoPagoOrder.bind(null, order.id)} className="mt-5 grid gap-3">
                    <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                      <input name="confirm" type="checkbox" value="yes" className="mt-1" />
                      Verificar con Mercado Pago. Solo se conciliará si el proveedor confirma pago acreditado.
                    </label>
                    <button
                      type="submit"
                      className="focus-ring inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink)]"
                    >
                      Verificar pago con Mercado Pago
                    </button>
                  </form>
                ) : null}
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">ADQUISICIÓN</h2>
                {attribution ? (
                  <div className="mt-4 grid gap-4 text-sm">
                    <AttributionBlock
                      title="Last touch"
                      source={attribution.last_touch_source}
                      medium={attribution.last_touch_medium}
                      campaign={attribution.last_touch_campaign}
                      content={attribution.last_touch_content}
                      landingPath={attribution.last_touch_landing_path}
                      referrer={attribution.last_touch_referrer}
                    />
                    <AttributionBlock
                      title="First touch"
                      source={attribution.first_touch_source}
                      medium={attribution.first_touch_medium}
                      campaign={attribution.first_touch_campaign}
                      content={attribution.first_touch_content}
                      landingPath={attribution.first_touch_landing_path}
                      referrer={attribution.first_touch_referrer}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--muted)]">Sin attribution snapshot.</p>
                )}
              </article>
              <article className="surface rounded-[8px] p-5">
                <h2 className="text-lg font-semibold">COMUNICACIONES</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  {allEmailEvents.map((event) => (
                    <div key={event.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{getEmailEventLabel(event)}</p>
                          <p className="text-[var(--muted)]">{event.recipient || "Sin recipient"}</p>
                        </div>
                        <EmailStatusBadge status={event.status} />
                      </div>
                      <p className="mt-2 text-[var(--muted)]">
                        {event.sent_at
                          ? `Enviado ${new Date(event.sent_at).toLocaleString("es-MX")}`
                          : event.last_attempt_at
                            ? `Último intento ${new Date(event.last_attempt_at).toLocaleString("es-MX")}`
                            : `Creado ${new Date(event.created_at).toLocaleString("es-MX")}`}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        Intentos: {event.attempt_count ?? 0}
                      </p>
                      {event.error_message ? (
                        <p className="mt-1 text-[var(--coral)]">{event.error_message}</p>
                      ) : null}
                      {canRetryEmail(event) ? (
                        <form action={retryTransactionalEmail.bind(null, order.id, event.id)} className="mt-3">
                          <button
                            type="submit"
                            className="focus-ring inline-flex h-9 items-center justify-center rounded-[8px] border border-[var(--ink)] px-3 text-xs font-semibold text-[var(--ink)]"
                          >
                            Reintentar email
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                  {allEmailEvents.length === 0 ? (
                    <p className="text-[var(--muted)]">Sin eventos de email.</p>
                  ) : null}
                </div>
              </article>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

function getFulfillmentErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    backend: "Backend no configurado.",
    confirm: "Confirma la acción antes de guardar.",
    order: "Orden no encontrada.",
    role: "Tu rol no permite cambiar fulfillment.",
    save: "No se pudo actualizar fulfillment.",
    shipment: "No se pudo actualizar el envío.",
    transition: "Solo una orden pagada y sin preparar puede pasar a preparing.",
  };

  return messages[reason] || "No se pudo actualizar fulfillment.";
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

function getPaymentErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    confirm: "Confirma la verificación antes de continuar.",
    reconcile: "Mercado Pago no pudo validar esta orden para conciliación.",
    role: "Tu rol no permite conciliar pagos.",
  };

  return messages[reason] || "No se pudo verificar el pago.";
}

function getEmailEventType(event: EmailEvent) {
  const value = event.event_type || event.template_key;

  if (value === "payment_confirmed") {
    return "ORDER_CONFIRMATION";
  }

  if (value === "order_shipped") {
    return "SHIPPING_CONFIRMATION";
  }

  return value;
}

function AttributionBlock({
  campaign,
  content,
  landingPath,
  medium,
  referrer,
  source,
  title,
}: {
  campaign: string;
  content: string;
  landingPath: string;
  medium: string;
  referrer: string;
  source: string;
  title: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
        {title}
      </p>
      <p className="mt-2 font-semibold text-[var(--ink)]">
        {source || "direct"} / {medium || "none"}
      </p>
      <dl className="mt-3 grid gap-2 text-xs text-[var(--muted)]">
        <div>
          <dt className="font-semibold text-[var(--ink)]">Campaign</dt>
          <dd>{campaign || "unknown"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--ink)]">Ad / Content</dt>
          <dd>{content || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--ink)]">Landing</dt>
          <dd className="break-all">{landingPath || "/"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--ink)]">Referrer</dt>
          <dd className="break-all">{referrer || "-"}</dd>
        </div>
      </dl>
    </div>
  );
}

function getEmailEventLabel(event: EmailEvent) {
  const labels: Record<string, string> = {
    ORDER_CONFIRMATION: "Confirmación de compra",
    SHIPPING_CONFIRMATION: "Confirmación de envío",
    DELIVERED_CONFIRMATION: "Confirmación de entrega",
    REVIEW_REQUEST: "Solicitud de reseña",
  };

  return labels[getEmailEventType(event)] || event.template_key;
}

function canRetryEmail(event: EmailEvent) {
  return event.status === "failed" || event.status === "skipped";
}

function EmailStatusBadge({ status }: { status: string }) {
  const palette =
    status === "sent"
      ? "border-[#cce8d7] bg-[#e7f5ec] text-[#1f6b43]"
      : status === "failed"
        ? "border-[#f1d1c8] bg-[#fff0ec] text-[#9a392b]"
        : status === "skipped"
          ? "border-[#efe3a8] bg-[#fff9db] text-[#7b6418]"
          : "border-[#d8e8fb] bg-[#eef5ff] text-[#315f8f]";
  const labels: Record<string, string> = {
    pending: "Pending",
    queued: "Pending",
    sent: "Sent",
    failed: "Failed",
    skipped: "Skipped",
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${palette}`}>
      {labels[status] || status}
    </span>
  );
}

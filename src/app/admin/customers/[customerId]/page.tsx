import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getAdminCustomerDetail } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";
import { getFeatureFlags } from "@/lib/settings";

import { saveCustomerNote } from "./actions";

export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { customerId } = await params;
  const query = searchParams ? await searchParams : {};
  const [{ customer, error }, featureFlags] = await Promise.all([
    getAdminCustomerDetail(customerId),
    getFeatureFlags(),
  ]);

  if (!customer && !error) {
    notFound();
  }

  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  const addresses = Array.isArray(customer?.customer_addresses)
    ? [...customer.customer_addresses].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )
    : [];
  const [latestAddress, ...previousAddresses] = addresses;
  const orders = Array.isArray(customer?.orders) ? customer.orders : [];
  const notes = Array.isArray(customer?.customer_notes)
    ? [...customer.customer_notes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    : [];
  const latestNote = notes[0]?.note || "";

  return (
    <main className="px-4 py-5 sm:px-6 lg:px-8">
      <Link
        href="/admin/customers"
        className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-[#716a63]"
      >
        <ArrowLeft size={16} aria-hidden />
        Clientes
      </Link>

      {error ? (
        <div className="mt-5 rounded-[8px] border border-[#f1d1c8] bg-white p-4 text-sm font-semibold text-[#9a392b]">
          {error}
        </div>
      ) : null}

      {query.note === "saved" ? (
        <div className="mt-5 rounded-[8px] border border-[#cce8d7] bg-[#f1fbf8] p-4 text-sm font-semibold text-[#1f6b43]">
          Nota interna guardada.
        </div>
      ) : null}

      {customer ? (
        <>
          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[8px] border border-[#e6ded3] bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e]">
                    Perfil de cliente
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-[#171310]">
                    {name || customer.email}
                  </h1>
                  <div className="mt-4 grid gap-1 text-sm text-[#716a63]">
                    <p>{customer.email}</p>
                    <p>{customer.phone || "Sin teléfono"}</p>
                    <p>
                      {[latestAddress?.city, latestAddress?.state].filter(Boolean).join(", ") ||
                        "Sin ciudad guardada"}
                    </p>
                  </div>
                </div>
                <span className="inline-flex w-fit rounded-full border border-[#d9ece8] bg-[#f1fbf8] px-3 py-1 text-xs font-semibold uppercase text-[#0f5f58]">
                  {customer.segment}
                </span>
              </div>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Field label="Orders" value={String(customer.paid_orders_count)} />
                <Field
                  label="Lifetime spend"
                  value={formatMoney(customer.lifetime_spend_cents)}
                />
                <Field
                  label="Average order value"
                  value={formatMoney(customer.average_order_value_cents)}
                />
                <Field
                  label="Last order"
                  value={customer.last_order ? formatDate(customer.last_order.paid_at || customer.last_order.created_at) : "-"}
                />
                <Field
                  label="First order"
                  value={customer.first_order ? formatDate(customer.first_order.paid_at || customer.first_order.created_at) : "-"}
                />
              </dl>
              {customer.acquisition ? (
                <div className="mt-5 rounded-[8px] border border-[#e6ded3] bg-[#faf7f1] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e]">
                    Acquisition source
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#171310]">
                    {customer.acquisition.first_touch_source || "direct"} /{" "}
                    {customer.acquisition.first_touch_medium || "none"}
                  </p>
                  <p className="mt-1 text-xs text-[#716a63]">
                    Campaign: {customer.acquisition.first_touch_campaign || "unknown"}
                  </p>
                </div>
              ) : null}
            </div>

            <aside className="rounded-[8px] border border-[#e6ded3] bg-white p-5">
              <h2 className="text-base font-semibold">Direcciones utilizadas</h2>
              <div className="mt-4 grid gap-4 text-sm text-[#716a63]">
                {latestAddress ? (
                  <AddressBlock
                    address={latestAddress}
                    label={latestAddress.is_default_shipping ? "Más reciente · default" : "Más reciente"}
                  />
                ) : (
                  <p>Sin direcciones guardadas.</p>
                )}
                {previousAddresses.length ? (
                  <div className="border-t border-[#eee6dc] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8178]">
                      Anteriores
                    </p>
                    <div className="mt-3 grid gap-4">
                      {previousAddresses.map((address) => (
                        <AddressBlock key={address.id} address={address} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className="overflow-hidden rounded-[8px] border border-[#e6ded3] bg-white">
              <div className="border-b border-[#eee6dc] p-4">
                <h2 className="text-base font-semibold">Historial de compras</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="text-xs font-semibold uppercase text-[#8a8178]">
                    <tr>
                      <th className="px-4 py-3">Orden</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Productos</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const items = Array.isArray(order.order_items) ? order.order_items : [];

                      return (
                        <tr key={order.id} className="border-t border-[#f0e8de] hover:bg-[#faf7f1]">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="focus-ring font-semibold text-[#173f3a] hover:text-[#0f766e]"
                            >
                              {order.order_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-[#716a63]">{formatDate(order.created_at)}</td>
                          <td className="px-4 py-3 text-[#716a63]">
                            {items.map((item) => `${item.name} x${item.quantity}`).join(", ") || "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatMoney(order.total_cents, order.currency)}
                          </td>
                          <td className="px-4 py-3 text-[#716a63]">{order.payment_status}</td>
                          <td className="px-4 py-3 text-[#716a63]">{order.fulfillment_status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {orders.length === 0 ? (
                <p className="px-4 py-8 text-sm text-[#716a63]">Sin órdenes registradas.</p>
              ) : null}
            </article>

            <aside className="rounded-[8px] border border-[#e6ded3] bg-white p-5">
              <h2 className="text-base font-semibold">Notas internas</h2>
              {!featureFlags.customerNotesEnabled ? (
                <p className="mt-3 rounded-[8px] border border-[var(--line)] bg-[var(--background)] p-3 text-sm leading-6 text-[#716a63]">
                  Las notas internas están desactivadas desde Settings.
                </p>
              ) : null}
              <form action={saveCustomerNote.bind(null, customer.id)} className="mt-4 grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a8178]">
                  Nota
                </label>
                <textarea
                  name="note"
                  defaultValue={latestNote}
                  maxLength={1000}
                  rows={6}
                  disabled={!featureFlags.customerNotesEnabled}
                  className="focus-ring min-h-36 rounded-[8px] border border-[#e4dbcf] bg-white p-3 text-sm leading-6 text-[#171310]"
                  placeholder="Prefiere entrega por la mañana, pidió factura, cliente frecuente..."
                />
                <button
                  type="submit"
                  disabled={!featureFlags.customerNotesEnabled}
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] bg-[#173f3a] px-4 text-sm font-semibold text-white"
                >
                  Guardar nota
                </button>
              </form>
              <div className="mt-5 grid gap-3">
                {notes.slice(0, 4).map((note) => (
                  <div key={note.id} className="border-t border-[#eee6dc] pt-3">
                    <p className="text-sm leading-6 text-[#171310]">{note.note}</p>
                    <p className="mt-1 text-xs text-[#716a63]">
                      Actualizada {formatDateTime(note.created_at)}
                    </p>
                  </div>
                ))}
                {notes.length === 0 ? (
                  <p className="text-sm text-[#716a63]">Sin notas internas.</p>
                ) : null}
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#eee6dc] bg-[#fffdf8] p-3">
      <dt className="text-xs text-[#716a63]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[#171310]">{value}</dd>
    </div>
  );
}

function AddressBlock({
  address,
  label,
}: {
  address: {
    full_name?: string | null;
    line1?: string | null;
    line2?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  };
  label?: string;
}) {
  return (
    <div className="leading-6">
      {label ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e]">
          {label}
        </p>
      ) : null}
      <p className="font-semibold text-[#171310]">{address.full_name || "Sin nombre"}</p>
      <p>{address.line1}</p>
      {address.line2 ? <p>{address.line2}</p> : null}
      {address.neighborhood ? <p>{address.neighborhood}</p> : null}
      <p>
        {address.city}, {address.state} {address.postal_code}
      </p>
      <p>{address.country}</p>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

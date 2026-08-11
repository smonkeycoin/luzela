import Link from "next/link";

import { getAdminOrders } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

export default async function AdminOrdersPage() {
  const { orders, error } = await getAdminOrders();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Orders</h1>
      {error ? (
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-white p-4 text-sm font-semibold text-[var(--coral)]">
          {error}
        </div>
      ) : null}
      <section className="surface mt-6 rounded-[8px] p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="py-3 pr-4">Order</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Payment</th>
                <th className="py-3 pr-4">Fulfillment</th>
                <th className="py-3 pr-4">Created</th>
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
                  <td className="py-3 pr-4">{order.customer_email}</td>
                  <td className="py-3 pr-4">{formatMoney(order.total_cents, order.currency)}</td>
                  <td className="py-3 pr-4">{order.payment_status}</td>
                  <td className="py-3 pr-4">{order.fulfillment_status}</td>
                  <td className="py-3 pr-4">{new Date(order.created_at).toLocaleString("es-MX")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? (
            <p className="py-6 text-sm text-[var(--muted)]">No hay ordenes todavia.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

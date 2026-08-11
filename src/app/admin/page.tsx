import { AlertTriangle, Boxes, Clock, DollarSign, ShoppingCart, Users } from "lucide-react";

import { getAdminDashboard } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

const modules = [
  "Orders",
  "Products",
  "Inventory",
  "Customers",
  "Coupons",
  "Shipping",
  "Analytics",
  "Settings",
];

export default async function AdminDashboardPage() {
  const { metrics, error } = await getAdminDashboard();
  const dashboardMetrics = [
    {
      label: "Orders",
      value: String(metrics?.orders ?? 0),
      note: "Todas las ordenes Test",
      icon: ShoppingCart,
    },
    {
      label: "Revenue Test",
      value: formatMoney(metrics?.revenueCents ?? 0),
      note: "Solo payment_status paid",
      icon: DollarSign,
    },
    {
      label: "Units sold",
      value: String(metrics?.unitsSold ?? 0),
      note: "Items en ordenes pagadas",
      icon: Boxes,
    },
    {
      label: "Stock",
      value: String(metrics?.stock ?? 0),
      note: "Suma inventory.stock_on_hand",
      icon: Boxes,
    },
    {
      label: "Low stock",
      value: String(metrics?.lowStock ?? 0),
      note: "Menor o igual al umbral",
      icon: AlertTriangle,
    },
    {
      label: "Customers",
      value: String(metrics?.customers ?? 0),
      note: "Guest + auth-ready",
      icon: Users,
    },
  ];

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Operacion
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Dashboard</h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
          <Clock size={16} aria-hidden />
          Datos reales desde Supabase Test
        </div>
      </div>
      {error ? (
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-white p-4 text-sm font-semibold text-[var(--coral)]">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardMetrics.map((metric) => (
          <article key={metric.label} className="surface rounded-[8px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">{metric.value}</p>
              </div>
              <metric.icon className="text-[var(--coral)]" size={22} aria-hidden />
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="surface rounded-[8px] p-5">
          <h2 className="text-lg font-semibold">Modulos V1</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((module) => (
              <div key={module} className="rounded-[8px] border border-[var(--line)] bg-white p-4">
                <p className="text-sm font-semibold">{module}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  CRUD y auditoria definidos para Sprint 1.
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="surface rounded-[8px] p-5">
          <div className="flex items-center gap-2 text-[var(--coral)]">
            <AlertTriangle size={20} aria-hidden />
            <h2 className="text-lg font-semibold text-[var(--ink)]">Guardrails</h2>
          </div>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-[var(--muted)]">
            <li>Service role solo en servidor.</li>
            <li>Pago confirmado solo por webhook Stripe firmado.</li>
            <li>Inventario vendido solo si existe disponibilidad calculada.</li>
            <li>Mutaciones relevantes registradas en audit_log.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

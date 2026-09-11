import type { ReactNode } from "react";
import { Boxes, CheckCircle2, CircleAlert } from "lucide-react";

import { MANUAL_INVENTORY_MOVEMENTS } from "@/lib/admin/operations";
import { getAdminInventory } from "@/lib/admin/queries";

import { createInventoryAdjustment } from "./actions";
import { updateInventoryThreshold, updateProductVisibility } from "../products/actions";

const resultMessages: Record<string, string> = {
  movement_saved: "Movimiento registrado en ledger y stock actualizado.",
  threshold_saved: "Umbral de stock actualizado.",
  visibility_enabled: "Producto visible en tienda.",
  visibility_disabled: "Producto oculto de tienda.",
  unchanged: "No hubo cambios que guardar.",
};

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const result = String(query.result || "");
  const reason = String(query.reason || "");
  const { inventory, movements, error } = await getAdminInventory();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Stock por SKU
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Inventory</h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
          <Boxes size={16} aria-hidden />
          Inventario independiente por producto
        </div>
      </div>

      {error ? <Status tone="error">{error}</Status> : null}
      {result && result !== "error" ? (
        <Status tone="success">{resultMessages[result] || "Operación guardada."}</Status>
      ) : null}
      {result === "error" ? (
        <Status tone="error">{getInventoryError(reason)}</Status>
      ) : null}

      {inventory ? (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Stock físico total" value={`${inventory.stock_on_hand} unidades`} />
            <Metric label="Estado" value={stockStatusLabel(inventory.stock_status)} />
            <Metric label="SKUs" value={`${inventory.items.length}`} />
            <Metric
              label="Visibles"
              value={`${inventory.items.filter((item) => item.is_visible).length}`}
            />
          </section>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Cada SKU puede tener su propio low-stock threshold. Si no se define, se usa Settings:
            low stock ≤ {inventory.low_stock_threshold}, critical ≤ {inventory.critical_stock_threshold}.
          </p>

          <section className="mt-6 grid gap-6">
            <article className="surface min-w-0 overflow-hidden rounded-[8px] p-5">
              <h2 className="text-xl font-semibold">Catálogo e inventario</h2>
              <div className="mt-5 max-w-full overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="py-3 pr-4">Producto</th>
                      <th className="py-3 pr-4">SKU</th>
                      <th className="py-3 pr-4">Stock físico</th>
                      <th className="py-3 pr-4">Disponible</th>
                      <th className="py-3 pr-4">Mostrar</th>
                      <th className="py-3 pr-4">Threshold</th>
                      <th className="py-3 pr-4">Movimiento</th>
                      <th className="py-3 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.items.map((item) => (
                      <tr key={item.variant_id} className="border-b border-[var(--line)] align-top last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-semibold">{item.product_name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{item.variant_name}</p>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">{item.sku}</td>
                        <td className="py-3 pr-4 font-semibold">{item.stock_on_hand}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`rounded-[6px] px-2 py-1 text-xs font-semibold ${
                              item.stock_status === "out_of_stock"
                                ? "bg-red-50 text-[var(--coral)]"
                                : item.stock_status === "low_stock"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-[var(--teal)]"
                            }`}
                          >
                            {item.stock_status_label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <form action={updateProductVisibility.bind(null, item.product_id)}>
                            <input type="hidden" name="return_to" value="/admin/inventory" />
                            <input
                              type="hidden"
                              name="is_visible"
                              value={item.is_visible ? "no" : "yes"}
                            />
                            <button className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]">
                              <span
                                aria-hidden
                                className={`grid size-4 place-items-center border ${
                                  item.is_visible
                                    ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                                    : "border-[var(--muted)] bg-white"
                                }`}
                              >
                                {item.is_visible ? "✓" : ""}
                              </span>
                              {item.is_visible ? "Visible" : "Oculto"}
                            </button>
                          </form>
                        </td>
                        <td className="py-3 pr-4">
                          <form
                            action={updateInventoryThreshold.bind(null, item.variant_id)}
                            className="flex items-center gap-2"
                          >
                            <input
                              name="low_stock_threshold"
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={item.low_stock_threshold}
                              className="focus-ring h-9 w-20 rounded-[8px] border border-[var(--line)] bg-white px-2"
                            />
                            <button className="focus-ring h-9 rounded-[8px] border border-[var(--line)] px-3 text-xs font-semibold">
                              Guardar
                            </button>
                          </form>
                        </td>
                        <td className="py-3 pr-4">
                          <details>
                            <summary className="cursor-pointer text-xs font-semibold text-[var(--teal)]">
                              Ajustar
                            </summary>
                            <form
                              action={createInventoryAdjustment.bind(null, item.variant_id)}
                              className="mt-3 grid w-64 gap-2 rounded-[8px] border border-[var(--line)] bg-white p-3"
                            >
                              <select
                                name="movement_type"
                                className="focus-ring h-10 rounded-[8px] border border-[var(--line)] bg-white px-2"
                              >
                                {MANUAL_INVENTORY_MOVEMENTS.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <input
                                name="quantity"
                                type="number"
                                required
                                step="1"
                                className="focus-ring h-10 rounded-[8px] border border-[var(--line)] bg-white px-2"
                                placeholder="+4, -1"
                              />
                              <textarea
                                name="note"
                                required
                                minLength={4}
                                className="focus-ring min-h-20 rounded-[8px] border border-[var(--line)] bg-white p-2"
                                placeholder="Nota obligatoria"
                              />
                              <input
                                name="reference"
                                className="focus-ring h-10 rounded-[8px] border border-[var(--line)] bg-white px-2"
                                placeholder="Referencia opcional"
                              />
                              <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                                <input name="confirm" type="checkbox" value="yes" className="mt-1" />
                                Confirmo movimiento.
                              </label>
                              <button className="focus-ring h-10 rounded-[8px] bg-[var(--ink)] px-3 text-xs font-semibold text-white">
                                Registrar movimiento
                              </button>
                            </form>
                          </details>
                        </td>
                        <td className="py-3 pr-4 text-xs text-[var(--muted)]">
                          product {item.product_status}
                          <br />
                          variant {item.variant_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {inventory.items.length === 0 ? (
                  <p className="py-6 text-sm text-[var(--muted)]">Sin SKUs configurados.</p>
                ) : null}
              </div>
            </article>
          </section>

          <section className="surface mt-6 min-w-0 overflow-hidden rounded-[8px] p-5">
            <h2 className="text-xl font-semibold">Ledger reciente</h2>
            <div className="mt-5 max-w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="py-3 pr-4">Fecha</th>
                    <th className="py-3 pr-4">Tipo</th>
                    <th className="py-3 pr-4">Delta</th>
                    <th className="py-3 pr-4">Razón</th>
                    <th className="py-3 pr-4">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="py-3 pr-4">{new Date(movement.created_at).toLocaleString("es-MX")}</td>
                      <td className="py-3 pr-4 font-semibold">{movement.movement_type}</td>
                      <td className="py-3 pr-4">{movement.quantity_delta}</td>
                      <td className="py-3 pr-4">{movement.reason || "-"}</td>
                      <td className="py-3 pr-4">{movement.metadata?.reference || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movements.length === 0 ? (
                <p className="py-6 text-sm text-[var(--muted)]">Sin movimientos todavía.</p>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <section className="surface mt-6 rounded-[8px] p-5 text-sm text-[var(--muted)]">
          No hay inventario físico configurado.
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface rounded-[8px] p-5">
      <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--ink)]">{value}</p>
    </article>
  );
}

function Status({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "error";
}) {
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;

  return (
    <div
      className={`mt-5 flex items-start gap-2 rounded-[8px] border border-[var(--line)] bg-white p-4 text-sm font-semibold ${
        tone === "success" ? "text-[var(--teal)]" : "text-[var(--coral)]"
      }`}
    >
      <Icon size={18} aria-hidden />
      {children}
    </div>
  );
}

function getInventoryError(reason: string) {
  const messages: Record<string, string> = {
    backend: "Backend no configurado.",
    confirm: "Confirma el movimiento antes de guardar.",
    inventory: "No se encontró el pool físico.",
    movement: "Tipo o cantidad inválidos.",
    movement_save: "No se pudo guardar el movimiento.",
    negative: "El ajuste dejaría stock negativo.",
    note: "La nota es obligatoria.",
    product: "Producto no encontrado.",
    role: "Tu rol no permite ajustar inventario.",
    stock_save: "No se pudo actualizar el stock.",
    threshold: "Umbral inválido.",
    threshold_save: "No se pudo guardar el umbral.",
    visibility_invalid:
      "No se puede mostrar: requiere producto active, variante active, precio mayor a 0 e inventario configurado.",
  };

  return messages[reason] || "No se pudo completar la operación.";
}

function stockStatusLabel(status: string) {
  const labels: Record<string, string> = {
    healthy: "Healthy",
    low: "Low",
    critical: "Critical",
    out_of_stock: "Agotado",
  };

  return labels[status] || status;
}

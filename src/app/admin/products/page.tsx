import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, PackageCheck } from "lucide-react";

import { getAdminProducts } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";

import { updateProductVisibility, updateVariantPrice, updateVariantStatus } from "./actions";

const resultMessages: Record<string, string> = {
  price_saved: "Precio actualizado. Storefront, carrito y checkout leerán el nuevo precio desde Supabase.",
  status_saved: "Estado actualizado. El storefront reflejará el cambio sin deploy.",
  visibility_enabled: "Producto visible en tienda.",
  visibility_disabled: "Producto oculto de tienda. Admin e historial se conservan.",
  unchanged: "No hubo cambios que guardar.",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const result = String(query.result || "");
  const reason = String(query.reason || "");
  const { products, error } = await getAdminProducts();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Catálogo operativo
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Products / Pricing</h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
          <PackageCheck size={16} aria-hidden />
          Source of truth: Supabase
        </div>
      </div>

      {error ? <Status tone="error">{error}</Status> : null}
      {result && result !== "error" ? (
        <Status tone="success">{resultMessages[result] || "Operación guardada."}</Status>
      ) : null}
      {result === "error" ? (
        <Status tone="error">{getProductError(reason)}</Status>
      ) : null}

      <section className="mt-6 grid gap-5">
        {products.map((product) => (
          <article key={product.id} className="surface rounded-[8px] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[var(--ink)]">{product.name}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                  {product.slug} · product {product.status}
                </p>
              </div>
              <div className="grid gap-3 sm:justify-items-end">
                <p className="text-sm font-semibold text-[var(--teal)]">
                  Envío {product.free_shipping ? "incluido" : "separado"}
                </p>
                <form action={updateProductVisibility.bind(null, product.id)}>
                  <input type="hidden" name="return_to" value="/admin/products" />
                  <input
                    type="hidden"
                    name="is_visible"
                    value={product.is_visible ? "no" : "yes"}
                  />
                  <button className="focus-ring inline-flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]">
                    <span
                      aria-hidden
                      className={`grid size-4 place-items-center border ${
                        product.is_visible
                          ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                          : "border-[var(--muted)] bg-white"
                      }`}
                    >
                      {product.is_visible ? "✓" : ""}
                    </span>
                    {product.is_visible ? "Visible en tienda" : "Oculto de tienda"}
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {product.product_variants.map((variant) => (
                <div
                  key={variant.id}
                  className="grid gap-4 rounded-[8px] border border-[var(--line)] bg-white p-4 xl:grid-cols-[minmax(0,1fr)_260px_260px]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <span className="rounded-[6px] bg-[var(--background)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                        {variant.name}
                      </span>
                      <span
                        className={`rounded-[6px] px-2 py-1 text-xs font-semibold ${
                          variant.status === "active"
                            ? "bg-emerald-50 text-[var(--teal)]"
                            : "bg-zinc-100 text-[var(--muted)]"
                        }`}
                      >
                        {variant.status}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="SKU" value={variant.sku} />
                    <Field label="Precio original" value={formatMoney(variant.price_cents, variant.currency)} />
                    <Field
                      label="Oferta"
                      value={
                        variant.offer_price_cents
                          ? `${formatMoney(variant.offer_price_cents, variant.currency)} · ${
                              variant.offer_active ? "activa" : "inactiva"
                            }`
                          : "Sin oferta"
                      }
                    />
                    <Field label="Units / pack" value={String(variant.units_per_pack)} />
                    <Field label="Availability" value={`${variant.available_packs} packs`} />
                    <Field
                      label="Preview"
                      value={`${formatMoney(variant.effective_price_cents, variant.currency)} · ${formatMoney(variant.price_per_unit_cents, variant.currency)} c/u`}
                    />
                    <Field label="Stock físico" value={`${variant.physical_stock_on_hand} botellas`} />
                    <Field label="Updated" value={new Date(variant.updated_at).toLocaleString("es-MX")} />
                  </dl>
                  </div>

                  <form action={updateVariantPrice.bind(null, variant.id)} className="grid gap-3">
                    <label className="grid gap-2 text-sm font-semibold">
                      Precio original MXN
                      <input
                        name="original_price"
                        type="number"
                        min="1"
                        step="0.01"
                        defaultValue={(variant.price_cents / 100).toFixed(2)}
                        className="focus-ring h-11 rounded-[8px] border border-[var(--line)] bg-white px-3"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Precio de oferta MXN
                      <input
                        name="offer_price"
                        type="number"
                        min="1"
                        step="0.01"
                        defaultValue={
                          variant.offer_price_cents
                            ? (variant.offer_price_cents / 100).toFixed(2)
                            : ""
                        }
                        className="focus-ring h-11 rounded-[8px] border border-[var(--line)] bg-white px-3"
                        placeholder="Opcional"
                      />
                    </label>
                    <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                      <input
                        name="offer_active"
                        type="checkbox"
                        value="yes"
                        defaultChecked={variant.offer_active}
                        className="mt-1"
                      />
                      Precio de oferta activo.
                    </label>
                    <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                      <input name="confirm" type="checkbox" value="yes" className="mt-1" />
                      Confirmo cambio de pricing. No modifica órdenes históricas.
                    </label>
                    <button className="focus-ring h-11 rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white">
                      Guardar precio
                    </button>
                  </form>

                  <form action={updateVariantStatus.bind(null, variant.id)} className="grid gap-3">
                    <label className="grid gap-2 text-sm font-semibold">
                      Estado comercial
                      <select
                        name="status"
                        defaultValue={variant.status === "active" ? "active" : "inactive"}
                        className="focus-ring h-11 rounded-[8px] border border-[var(--line)] bg-white px-3"
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </label>
                    <label className="flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
                      <input name="confirm" type="checkbox" value="yes" className="mt-1" />
                      Confirmo activar/desactivar este pack.
                    </label>
                    <button className="focus-ring h-11 rounded-[8px] border border-[var(--ink)] px-4 text-sm font-semibold text-[var(--ink)]">
                      Guardar estado
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </article>
        ))}

        {products.length === 0 ? (
          <div className="surface rounded-[8px] p-5 text-sm text-[var(--muted)]">
            No hay packs SUMMER disponibles en catálogo.
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-[var(--ink)]">{value}</dd>
    </div>
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

function getProductError(reason: string) {
  const messages: Record<string, string> = {
    backend: "Backend no configurado.",
    confirm: "Confirma la acción antes de guardar.",
    price: "El precio debe ser mayor a 0 y guardarse como cents enteros.",
    offer: "La oferta activa requiere precio de oferta mayor a 0 y menor al precio original.",
    role: "Tu rol no permite modificar productos.",
    save: "No se pudo guardar el cambio.",
    status: "Estado inválido.",
    product: "Producto no encontrado.",
    variant: "Variant no encontrada.",
    visibility_invalid:
      "No se puede mostrar: requiere producto active, variante active, precio mayor a 0 e inventario configurado.",
  };

  return messages[reason] || "No se pudo completar la operación.";
}

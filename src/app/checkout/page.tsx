import { CheckoutPromoProvider, CheckoutPromoField, CheckoutPromoTotals, CheckoutQuantitySummary } from '@/components/checkout-promo';
import { randomUUID } from "crypto";
import Link from "next/link";
import { ArrowLeft, ChevronDown, MapPin, Mail, Phone, ShieldCheck, Truck } from "lucide-react";

import { CheckoutForm } from "@/components/checkout-form";
import { CheckoutSubmitButton } from "@/components/checkout-submit-button";
import { FunnelCheckoutStart } from "@/components/funnel-checkout-start";
import { AttributionCheckoutField } from "@/components/attribution-checkout-field";
import { PaymentLogos } from "@/components/payment-logos";
import { ProductPackImage } from "@/components/product-pack-image";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { TrustBar } from "@/components/trust-bar";
import { getCheckoutProduct } from "@/lib/catalog/get-checkout-product";
import type { CatalogProduct } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";
import { getShippingPolicy } from "@/lib/settings";

const checkoutSteps = ["Datos", "Entrega", "Resumen", "Pago", "Confirmación"];

function getFriendlyError(error?: string) {
  if (!error) {
    return null;
  }

  if (error.includes("Selecciona")) {
    return "Selecciona un producto desde la tienda para continuar.";
  }

  if (error.includes("stock") || error.includes("Stock")) {
    return error;
  }

  return "No pudimos cargar este producto en este momento.";
}

function OrderSummary({
  product,
  quantity,
  shippingPolicy,
}: {
  product: CatalogProduct | null;
  quantity: number;
  shippingPolicy: Awaited<ReturnType<typeof getShippingPolicy>>;
}) {
  const shippingCents =
    product && !product.free_shipping && !shippingPolicy.freeShippingEnabled
      ? shippingPolicy.shippingFeeCents
      : 0;

  return (
    <div className="surface rounded-[8px] p-5">
      <h2 className="text-base font-semibold text-[var(--ink)]">Resumen</h2>
      <div className="mt-5 flex gap-4 border-b border-[var(--line)] pb-5">
        <div className="shrink-0">
          <ProductPackImage
            alt={product?.name || "Producto Luzela"}
            context="checkout"
            unitsPerPack={product?.variant.units_per_pack || 1}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--ink)]">{product?.name || "Producto Luzela"}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{product?.variant.name || "Elige tu producto"}</p>
          <CheckoutQuantitySummary quantity={quantity} unitsPerPack={product?.variant.units_per_pack || 1} />
          {product?.variant.offer_active && product.variant.offer_price_cents ? (
            <div className="mt-3">
              <p className="text-sm font-semibold text-[var(--muted)] line-through">
                {formatMoney(product.variant.price_cents, product.variant.currency)}
              </p>
              <p className="text-lg font-semibold text-[var(--teal)]">
                {formatMoney(product.variant.effective_price_cents, product.variant.currency)}
              </p>
            </div>
          ) : product ? (
            <p className="mt-3 text-lg font-semibold text-[var(--ink)]">
              {formatMoney(product.variant.effective_price_cents, product.variant.currency)}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-semibold text-[var(--teal)]">
            {product ? product.variant.stock_label : "Pendiente"}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid gap-4 text-sm">
        <CheckoutPromoTotals unitPrice={product?.variant.effective_price_cents || 0} shipping={shippingCents} currency={product?.variant.currency || 'mxn'} />
        <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
          <dt className="flex items-center gap-2 text-[var(--muted)]">
            <ShieldCheck size={16} aria-hidden />
            Pago seguro
          </dt>
          <dd className="text-right font-semibold">Mercado Pago</dd>
        </div>
        <div className="flex items-start gap-2 text-[var(--muted)]">
          <Truck size={16} className="mt-0.5 shrink-0 text-[var(--ink)]" aria-hidden />
          <span>{shippingPolicy.shortCopy}</span>
        </div>
      </dl>
      <div className="mt-6 border-t border-[var(--line)] pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Pagos seguros con
        </p>
        <div className="mt-3">
          <PaymentLogos />
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Tus datos bancarios son procesados por Mercado Pago y no son almacenados por Luzela.
        </p>
      </div>
      <figure className="mt-6 border-t border-[var(--line)] pt-5">
        <blockquote className="text-sm leading-6 text-[var(--muted)]">
          &ldquo;Me encanta porque no te deja grasosa la piel, y mi esposo se deja poner.&rdquo;
        </blockquote>
        <figcaption className="mt-2 text-sm font-semibold text-[var(--ink)]">Ana K.</figcaption>
      </figure>
    </div>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; quantity?: string }>;
}) {
  const { variant, quantity: quantityParam } = await searchParams;
  const [{ product, error }, shippingPolicy] = await Promise.all([
    getCheckoutProduct(variant),
    getShippingPolicy(),
  ]);
  const idempotencyKey = randomUUID();
  const available = (product?.variant.stock_on_hand ?? 0) > 0;
  const friendlyError = getFriendlyError(error);
  const requestedQuantity = Number(quantityParam || "1");
  const quantity =
    Number.isInteger(requestedQuantity) && requestedQuantity > 0
      ? Math.min(requestedQuantity, product?.variant.stock_on_hand || 10, 10)
      : 1;

  return (
    <main className="min-h-screen bg-[#f7f6f1]">
      {product && available ? <FunnelCheckoutStart sku={product.variant.sku} productId={product.id} quantity={quantity} valueCents={product.variant.effective_price_cents * quantity} /> : null}
      <PublicHeader />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={18} aria-hidden />
          Volver
        </Link>

        <CheckoutPromoProvider key={product?.variant.id || ""} variant={product?.variant.id || ""} initialQuantity={quantity} acceptManualCartCode>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <section className="surface min-w-0 rounded-[8px] p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              COMPRA SEGURA
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              Compra rápida, sin crear una cuenta.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Tus datos se usan únicamente para procesar y entregar tu pedido.
            </p>

            <div className="mt-6">
              <TrustBar />
            </div>

            <ol className="mt-7 grid gap-2 sm:grid-cols-5">
              {checkoutSteps.map((step, index) => (
                <li
                  key={step}
                  className="rounded-[8px] border border-[var(--line)] bg-white p-3 text-xs font-semibold text-[var(--muted)]"
                >
                  <span className="mb-2 block text-[var(--coral)]">0{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <details className="surface mt-6 rounded-[8px] p-4 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
                Resumen de compra
                <ChevronDown size={18} aria-hidden />
              </summary>
              <div className="mt-4">
                <OrderSummary product={product} quantity={quantity} shippingPolicy={shippingPolicy} />
              </div>
            </details>

            {friendlyError ? (
              <div className="mt-7 rounded-[8px] border border-[var(--line)] bg-white p-4 text-sm font-semibold text-[var(--coral)]">
                {friendlyError}
              </div>
            ) : null}

            <CheckoutForm
              action="/api/checkout"
              method="post"
              className="mt-8 grid min-w-0 grid-cols-1 gap-4"
              disabled={!product || !available}
            >
              <input type="hidden" name="product_variant_id" value={product?.variant.id || ""} />
              <input type="hidden" name="idempotency_key" value={idempotencyKey} />
              <AttributionCheckoutField />
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Cantidad
                <input
                  className="focus-ring min-w-0 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm"
                  name="quantity"
                  type="number"
                  min="1"
                  max={product ? Math.min(product.variant.stock_on_hand, 10) : 10}
                  defaultValue={quantity}
                  required
                  disabled={!product || !available}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Email
                <span className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} aria-hidden />
                  <input
                    className="focus-ring min-w-0 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white pl-10 pr-3 text-sm"
                    name="email"
                    type="email"
                    placeholder="cliente@correo.com"
                    required
                    disabled={!product || !available}
                  />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Teléfono
                <span className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} aria-hidden />
                  <input
                    className="focus-ring min-w-0 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white pl-10 pr-3 text-sm"
                    name="phone"
                    type="tel"
                    placeholder="+52..."
                    required
                    disabled={!product || !available}
                  />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Nombre completo
                <input
                  className="focus-ring min-w-0 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm"
                  name="full_name"
                  placeholder="Nombre y apellido"
                  required
                  disabled={!product || !available}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Calle y número
                <span className="relative">
                  <MapPin className="absolute left-3 top-4 text-[var(--muted)]" size={18} aria-hidden />
                  <input
                    className="focus-ring min-w-0 h-12 w-full rounded-[8px] border border-[var(--line)] bg-white pl-10 pr-3 text-sm"
                    name="address_line1"
                    placeholder="Calle, número exterior/interior"
                    required
                    disabled={!product || !available}
                  />
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                  Colonia
                  <input className="focus-ring min-w-0 h-12 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm" name="neighborhood" disabled={!product || !available} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                  Ciudad
                  <input className="focus-ring min-w-0 h-12 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm" name="city" required disabled={!product || !available} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                  Estado
                  <input className="focus-ring min-w-0 h-12 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm" name="state" required disabled={!product || !available} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                  Código postal
                  <input className="focus-ring min-w-0 h-12 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm" name="postal_code" required disabled={!product || !available} />
                </label>
              </div>
              <CheckoutPromoField />
              <CheckoutSubmitButton disabled={!product || !available} />
              <p className="text-xs leading-5 text-[var(--muted)]">
                Pago seguro. Tus datos bancarios no son almacenados por Luzela.
              </p>
              <p className="text-xs leading-5 text-[var(--muted)]">
                ¿Necesitas ayuda con tu pedido? Escríbenos desde la sección de contacto.
              </p>
            </CheckoutForm>
          </section>

          <aside className="hidden h-fit lg:block">
            <OrderSummary product={product} quantity={quantity} shippingPolicy={shippingPolicy} />
          </aside>
        </div>
        </CheckoutPromoProvider>
      </div>
      <PublicFooter />
    </main>
  );
}

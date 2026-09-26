"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import type { CatalogProduct } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";
import { trackCommerce } from "@/lib/analytics/client";

import { CartPromoSummary } from "./cart-promo-summary";
import { PaymentLogos } from "./payment-logos";
import { ProductPackImage } from "./product-pack-image";
import { type CartItem, useCart } from "./cart-store";

export function CartView({
  products,
  initialItems = [],
}: {
  products: CatalogProduct[];
  initialItems?: CartItem[];
}) {
  const { items, ready, update, remove } = useCart(initialItems);
  const hydratedItems = items
    .map((item) => {
      const product = products.find((candidate) => candidate.variant.id === item.variantId);
      if (!product) {
        return null;
      }

      const quantity = Math.min(item.quantity, product.variant.stock_on_hand);
      return { product, quantity };
    })
    .filter((item): item is { product: CatalogProduct; quantity: number } => Boolean(item));
  const subtotalCents = hydratedItems.reduce(
    (total, item) => total + item.product.variant.effective_price_cents * item.quantity,
    0,
  );
  const firstItem = hydratedItems[0];
  const canQuoteCart = hydratedItems.length === 1 && firstItem.product.free_shipping;

  useEffect(() => {
    if (hydratedItems.length > 0) trackCommerce("view_cart", {
      value_cents: subtotalCents,
      metadata: { item_count: hydratedItems.reduce((sum, item) => sum + item.quantity, 0) },
    }, "view_cart");
  }, [hydratedItems, subtotalCents]);

  if (!ready) {
    return (
      <div className="border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
        Preparando tu carrito.
      </div>
    );
  }

  if (hydratedItems.length === 0) {
    return (
      <div className="grid gap-5 border border-[var(--line)] bg-white p-8 text-center">
        <ShoppingBag className="mx-auto text-[var(--teal)]" size={36} aria-hidden />
        <h2 className="text-2xl font-semibold text-[var(--ink)]">Tu carrito está vacío.</h2>
        <p className="mx-auto max-w-sm text-sm leading-6 text-[var(--muted)]">
          Elige tu Luzela y vuelve aquí para revisar tu pedido antes del checkout.
        </p>
        <Link
          href="/#tienda"
          className="focus-ring mx-auto inline-flex h-12 items-center justify-center bg-[var(--ink)] px-5 text-sm font-semibold text-white"
        >
          Comprar Luzela
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section className="grid h-fit gap-4">
        {hydratedItems.map(({ product, quantity }) => {
          const available = product.variant.stock_on_hand > 0;

          return (
            <article
              key={product.variant.id}
              className="grid gap-5 border border-[var(--line)] bg-[var(--paper)] p-5 sm:grid-cols-[200px_minmax(0,1fr)_120px] sm:items-start"
            >
              <ProductPackImage
                alt={`${product.name} ${product.variant.units_per_pack}X`}
                context="cart"
                unitsPerPack={product.variant.units_per_pack}
              />
              <div className="grid gap-5">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--ink)]">{product.name}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{product.variant.name}</p>
                  {product.variant.units_per_pack >= 10 ? (
                    <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                      Incluye: {product.variant.units_per_pack} piezas
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {product.variant.units_per_pack} Luzela{product.variant.units_per_pack === 1 ? "" : "s"} por pack
                    </p>
                  )}
                  {product.variant.offer_active && product.variant.offer_price_cents ? (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-[var(--muted)] line-through">
                        {formatMoney(product.variant.price_cents, product.variant.currency)}
                      </p>
                      <p className="text-lg font-semibold text-[var(--teal)]">
                        {formatMoney(
                          product.variant.effective_price_cents,
                          product.variant.currency,
                        )}
                      </p>
                    </div>
                  ) : null}
                  <p className={`mt-3 text-sm font-semibold ${available ? "text-[var(--teal)]" : "text-[var(--coral)]"}`}>
                    {product.variant.stock_label}
                  </p>
                </div>
                <div className="inline-flex h-11 w-fit items-center border border-[var(--line)] bg-white">
                  <button
                    className="focus-ring grid h-11 w-11 place-items-center"
                    type="button"
                    aria-label="Reducir cantidad"
                    onClick={() => update(product.variant.id, quantity - 1, product.variant.stock_on_hand)}
                  >
                    <Minus size={16} aria-hidden />
                  </button>
                  <input
                    className="h-11 w-14 border-x border-[var(--line)] text-center text-sm font-semibold"
                    aria-label={`Cantidad de ${product.name}`}
                    type="number"
                    min="1"
                    max={product.variant.stock_on_hand}
                    value={quantity}
                    onChange={(event) =>
                      update(
                        product.variant.id,
                        Number(event.currentTarget.value),
                        product.variant.stock_on_hand,
                      )
                    }
                  />
                  <button
                    className="focus-ring grid h-11 w-11 place-items-center disabled:text-zinc-300"
                    type="button"
                    aria-label="Aumentar cantidad"
                    disabled={quantity >= product.variant.stock_on_hand}
                    onClick={() => update(product.variant.id, quantity + 1, product.variant.stock_on_hand)}
                  >
                    <Plus size={16} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:grid sm:justify-items-end">
                <p className="text-lg font-semibold text-[var(--ink)]">
                  {formatMoney(product.variant.effective_price_cents * quantity, product.variant.currency)}
                </p>
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--coral)]"
                  onClick={() => remove(product.variant.id)}
                >
                  <Trash2 size={16} aria-hidden />
                  Eliminar
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <aside className="h-fit border border-[var(--line)] bg-white p-5">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Resumen</h2>
        <dl className="mt-5 grid gap-4 text-sm">
          <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
            <dt className="text-[var(--muted)]">Packs</dt>
            <dd className="font-semibold">
              {hydratedItems.reduce((total, item) => total + item.quantity, 0)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
            <dt className="text-[var(--muted)]">Luzelas físicas</dt>
            <dd className="font-semibold">
              {hydratedItems.reduce(
                (total, item) => total + item.quantity * item.product.variant.units_per_pack,
                0,
              )}
            </dd>
          </div>
          {!canQuoteCart ? <>
          <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
            <dt className="text-[var(--muted)]">Subtotal</dt>
            <dd className="font-semibold">{formatMoney(subtotalCents, firstItem.product.variant.currency)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
            <dt className="text-[var(--muted)]">Envío</dt>
            <dd className="text-right font-semibold">
              {firstItem.product.free_shipping ? "Incluido" : "Se confirma en checkout"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--ink)]">Total</dt>
            <dd className="text-right font-semibold">
              {firstItem.product.free_shipping
                ? formatMoney(subtotalCents, firstItem.product.variant.currency)
                : "Se confirma en checkout"}
            </dd>
          </div>
          </> : null}
        </dl>
        {canQuoteCart ? (
          <CartPromoSummary variant={firstItem.product.variant.id} quantity={firstItem.quantity}
            price={firstItem.product.variant.effective_price_cents} currency={firstItem.product.variant.currency} />
        ) : (
        <Link
          href={`/checkout?variant=${firstItem.product.variant.id}&quantity=${firstItem.quantity}`}
          className="focus-ring mt-6 inline-flex h-12 w-full items-center justify-center bg-[var(--ink)] px-5 text-sm font-semibold text-white"
        >
          Continuar al checkout
        </Link>
        )}
        {hydratedItems.length > 1 ? (
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Puedes finalizar un producto a la vez en el checkout seguro.
          </p>
        ) : null}
        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Pagos seguros con
          </p>
          <div className="mt-3">
            <PaymentLogos />
          </div>
        </div>
      </aside>
    </div>
  );
}

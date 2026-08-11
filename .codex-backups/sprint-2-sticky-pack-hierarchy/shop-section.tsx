import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { CatalogProduct } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";

import { AddToCartButton } from "./add-to-cart-button";

function isDuo(product: CatalogProduct) {
  return /d[uú]o/i.test(`${product.name} ${product.variant.name}`);
}

function isSummer(product: CatalogProduct) {
  return product.variant.analytics_item_id.startsWith("summer_");
}

function getSummerOrderClasses(unitsPerPack: number) {
  if (unitsPerPack === 3) {
    return "order-1 lg:order-2";
  }

  if (unitsPerPack === 2) {
    return "order-2 lg:order-3";
  }

  return "order-3 lg:order-1";
}

export function ShopSection({ products, error }: { products: CatalogProduct[]; error?: string }) {
  const summerMode = products.some(isSummer);
  const sorted = [...products].sort((a, b) => {
    if (summerMode) {
      const desktopOrder = new Map([
        [1, 1],
        [3, 2],
        [2, 3],
      ]);
      return (
        (desktopOrder.get(a.variant.units_per_pack) || 9) -
        (desktopOrder.get(b.variant.units_per_pack) || 9)
      );
    }

    return Number(isDuo(b)) - Number(isDuo(a));
  });

  return (
    <section
      id="tienda"
      data-travel-products
      className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24"
    >
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Tienda
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            {summerMode ? "ELIGE TU SUMMER" : "Elige tu Luzela."}
          </h2>
          {summerMode ? (
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
              Una para ti. Dos para compartir. Tres para que no falte.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="max-w-md border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--coral)]">
            No pudimos cargar el catálogo en este momento.
          </p>
        ) : null}
      </div>

      {sorted.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
          {sorted.map((product) => {
            const available = product.variant.stock_on_hand > 0;
            const duo = isDuo(product);
            const summer = isSummer(product);
            const featured = summer
              ? product.variant.units_per_pack === 3
              : duo;
            const orderClass = summer
              ? getSummerOrderClasses(product.variant.units_per_pack)
              : "";

            return (
              <article
                key={product.id}
                data-travel-duo={featured ? "true" : undefined}
                className={`grid w-full min-w-0 max-w-full gap-6 border border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6 ${
                  summer
                    ? `${orderClass} lg:grid-rows-[220px_1fr] ${featured ? "bg-white lg:-my-5 lg:p-7" : ""}`
                    : `sm:grid-cols-[180px_1fr] ${duo ? "lg:grid-cols-[220px_1fr] lg:bg-white" : ""}`
                }`}
              >
                <div
                  data-travel-duo-visual={featured ? "true" : undefined}
                  className="grid aspect-square w-full min-w-0 max-w-full place-items-center overflow-hidden bg-white"
                >
                  <Image
                    src={product.image_url || "/luzela/bottle.webp"}
                    alt={product.name}
                    width={featured ? 240 : 180}
                    height={featured ? 240 : 180}
                    className="h-[82%] w-auto object-contain"
                  />
                </div>
                <div className="flex min-w-0 flex-col justify-between">
                  <div>
                    {product.variant.badge ? (
                      <p className="mb-4 inline-flex border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
                        {product.variant.badge}
                      </p>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">
                          {product.name}
                        </h3>
                        <p className="mt-2 text-sm text-[var(--muted)]">{product.variant.name}</p>
                        {product.variant.secondary_headline ? (
                          <p className="mt-3 text-lg font-semibold text-[var(--ink)]">
                            {product.variant.secondary_headline}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-semibold text-[var(--ink)]">
                          {formatMoney(product.variant.price_cents, product.variant.currency)}
                        </p>
                        {product.variant.unit_price_label ? (
                          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                            {product.variant.unit_price_label}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                      {summer
                        ? product.description
                        : duo
                        ? "Dos Luzelas, más días para recordar."
                        : product.description || "SPF 50+ mineral para tus días de sol."}
                    </p>
                    {product.free_shipping ? (
                      <p className="mt-4 inline-flex border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
                        Envío incluido
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className={`text-sm font-semibold ${available ? "text-[var(--teal)]" : "text-[var(--coral)]"}`}>
                      {available ? "Disponible" : "Sin stock disponible"}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                      <AddToCartButton product={product} featured={featured} />
                      <Link
                        href={`/checkout?variant=${product.variant.id}`}
                        className="focus-ring inline-flex h-12 items-center justify-center gap-2 border border-[var(--ink)] px-5 text-sm font-semibold text-[var(--ink)]"
                      >
                        {summer ? `Elegir ${product.variant.units_per_pack}X` : "Comprar ahora"}
                        <ArrowRight size={16} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)]">
          El catálogo no está disponible por el momento.
        </div>
      )}
    </section>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Leaf, MapPin, ShieldCheck, Truck } from "lucide-react";

import type { CatalogProduct } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";

import { AddToCartButton } from "./add-to-cart-button";
import { ProductPackImage } from "./product-pack-image";
import { FunnelProductView } from "./funnel-product-view";
import { trackCommerce } from "@/lib/analytics/client";
import { isSummerDropProduct } from "@/lib/catalog/summer-drop";

function isDuo(product: CatalogProduct) {
  return /d[uú]o/i.test(`${product.name} ${product.variant.name}`);
}

function isSummer(product: CatalogProduct) {
  return product.variant.analytics_item_id.startsWith("summer_");
}

function getSummerOrderClasses(unitsPerPack: number) {
  if (unitsPerPack === 3) {
    return "order-1";
  }
  return "order-2";
}

function getSummerCardClasses(unitsPerPack: number) {
  if (unitsPerPack === 3) {
    return "border-[var(--teal)] bg-[linear-gradient(145deg,#e8faf6_0%,#fffdf7_100%)] p-5 shadow-[0_18px_45px_rgba(20,123,117,0.16)] ring-1 ring-[var(--teal)]/20 sm:p-6";
  }

  if (unitsPerPack === 2) {
    return "border-[var(--line)] bg-white/85 p-5 sm:p-6";
  }

  return "border-[var(--line)] bg-[var(--paper)] p-5 sm:p-6";
}

const summerTrustFacts = [
  { icon: Truck, label: "Envío incluido a todo México" },
  { icon: ShieldCheck, label: "SPF 50+ / 100% mineral" },
  { icon: Leaf, label: "Ocean & Cenote Friendly" },
  { icon: MapPin, label: "Hecho en México — Guadalajara, Jalisco" },
];

export function ShopSection({ products, error }: { products: CatalogProduct[]; error?: string }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) timer = setTimeout(() => trackCommerce("view_shop", {}, "view_shop"), 1000);
      else clearTimeout(timer);
    }, { threshold: [0, 0.5, 1] });
    observer.observe(node);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);
  const summerMode = products.some((product) => isSummerDropProduct(product));
  const [category, setCategory] = useState("Todos");
  const sorted = useMemo(() => [...products].sort((a, b) => {
    if (summerMode) {
      const desktopOrder = new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ]);
      return (
        (desktopOrder.get(a.variant.units_per_pack) || 9) -
        (desktopOrder.get(b.variant.units_per_pack) || 9)
      );
    }

    return a.sort_order - b.sort_order;
  }), [products, summerMode]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(sorted.map((product) => product.category).filter((value): value is string => Boolean(value))),
      ),
    [sorted],
  );
  const campaignProducts = summerMode
    ? sorted.filter((product) => product.variant.units_per_pack !== 2)
    : sorted;
  const visibleProducts =
    category === "Todos" ? campaignProducts : campaignProducts.filter((product) => product.category === category);

  return (
    <section
      id="tienda"
      data-travel-products
      className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24"
    >
      <span id="summer-drop" className="scroll-mt-20" aria-hidden="true" />
      <div ref={sectionRef} className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Tienda
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
            {summerMode ? "ELIGE TU SUMMER" : "Catálogo"}
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
        <div
          className={
            summerMode
              ? "relative grid gap-8"
              : "grid gap-4 lg:grid-cols-3 lg:items-stretch"
          }
        >
          <div
            className={
              summerMode
                ? "grid gap-4 md:grid-cols-2 lg:items-stretch"
                : "contents"
            }
          >
            {!summerMode && categories.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-2 lg:col-span-3">
                {["Todos", ...categories].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`focus-ring rounded-[8px] border px-3 py-2 text-sm font-semibold ${
                      category === item
                        ? "border-[var(--teal)] bg-[var(--teal)] text-white"
                        : "border-[var(--line)] bg-white text-[var(--ink)]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
            {visibleProducts.map((product) => {
              const available = product.variant.stock_on_hand > 0;
              const duo = isDuo(product);
              const summer = isSummer(product);
              const campaignCard = summerMode && summer;
              const featured = campaignCard
                ? product.variant.units_per_pack === 3
                : duo;
              const orderClass = campaignCard
                ? getSummerOrderClasses(product.variant.units_per_pack)
                : "";
              const hasOffer = product.variant.offer_active && product.variant.offer_price_cents;

              return (
                <FunnelProductView
                  key={product.id}
                  productId={product.id}
                  sku={product.variant.sku}
                  summerPack={summer ? `${product.variant.units_per_pack}x` : undefined}
                  featured={featured}
                  className={`grid w-full min-w-0 max-w-full border ${
                    campaignCard
                      ? `${orderClass} ${getSummerCardClasses(product.variant.units_per_pack)} grid-rows-[auto_1fr] gap-5`
                      : `border-[var(--line)] bg-[var(--paper)] p-5 sm:grid-cols-[180px_1fr] sm:p-6 ${duo ? "lg:grid-cols-[220px_1fr] lg:bg-white" : ""}`
                  }`}
                >
                  <div data-travel-duo-visual={featured ? "true" : undefined}>
                    {summer ? (
                      <ProductPackImage
                        alt={`${product.name} ${product.variant.units_per_pack}X`}
                        context="card"
                        unitsPerPack={product.variant.units_per_pack}
                      />
                    ) : (
                      <div className="grid aspect-square w-full min-w-0 max-w-full place-items-center overflow-hidden bg-white">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={featured ? 240 : 180}
                            height={featured ? 240 : 180}
                            className="h-[82%] w-auto object-contain"
                          />
                        ) : (
                          <div className="grid size-full place-items-center p-6 text-center text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                            {product.name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className={
                      campaignCard
                        ? "grid min-w-0 grid-rows-[36px_auto_24px_52px_minmax(84px,auto)_40px_1fr_auto] gap-3"
                        : "flex min-w-0 flex-col justify-between"
                    }
                  >
                    <div className={summer ? "flex items-start" : undefined}>
                      {product.variant.badge ? (
                        <p className="inline-flex border border-[var(--teal)]/30 bg-[var(--background)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
                          {product.variant.badge}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">
                        {product.name}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {product.variant.name}
                      </p>
                    </div>
                    <p className="text-lg font-semibold leading-6 text-[var(--ink)]">
                      {campaignCard && product.variant.units_per_pack === 3
                        ? "PAGA 2. RECIBE 3."
                        : product.variant.secondary_headline || "\u00a0"}
                    </p>
                    <div>
                      {hasOffer ? (
                        <p className="text-sm font-semibold text-[var(--muted)] line-through decoration-[var(--muted)]/70 decoration-1">
                          {formatMoney(product.variant.price_cents, product.variant.currency)}
                        </p>
                      ) : null}
                      <p
                        className={`font-semibold ${
                          hasOffer || featured
                            ? "text-2xl text-[var(--teal)]"
                            : "text-xl text-[var(--ink)]"
                        }`}
                      >
                        {formatMoney(
                          product.variant.effective_price_cents,
                          product.variant.currency,
                        )}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                        {product.variant.unit_price_label || "\u00a0"}
                      </p>
                    </div>
                    <p className="text-sm leading-7 text-[var(--muted)]">
                      {campaignCard && product.variant.units_per_pack === 3
                        ? "3 Luzelas por $769. Envío incluido. Edición limitada, hasta agotar existencias."
                        : summer
                          ? product.description
                        : duo
                          ? "Dos Luzelas, más días para recordar."
                          : product.description || ""}
                    </p>
                    <div>
                      {product.free_shipping ? (
                        <p className="inline-flex border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
                          Envío incluido
                        </p>
                      ) : null}
                    </div>
                    <div />
                    <div className="flex flex-col gap-3">
                      <p
                        className={`text-sm font-semibold ${
                          available ? "text-[var(--teal)]" : "text-[var(--coral)]"
                        }`}
                      >
                        {product.variant.stock_label}
                      </p>
                      <AddToCartButton product={product} featured={featured} />
                    </div>
                  </div>
                </FunnelProductView>
              );
            })}
          </div>
          {summerMode ? (
            <>
              <div
                data-travel-sticky-slot
                className="pointer-events-none absolute right-0 top-1/2 hidden h-1 w-1 lg:block"
                aria-hidden="true"
              />
              <div
                data-summer-trust-strip
                className="grid gap-4 border-y border-[var(--line)] py-6 sm:grid-cols-2 lg:grid-cols-4"
              >
                {summerTrustFacts.map((fact) => (
                  <p
                    key={fact.label}
                    className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]"
                  >
                    <fact.icon size={16} className="text-[var(--teal)]" aria-hidden />
                    {fact.label}
                  </p>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)]">
          El catálogo no está disponible por el momento.
        </div>
      )}
    </section>
  );
}

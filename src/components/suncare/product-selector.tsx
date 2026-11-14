"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Truck } from "lucide-react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";
import { trackCommerce } from "@/lib/analytics/client";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { FunnelProductView } from "@/components/funnel-product-view";
import { BottleComposition } from "./bottle-composition";
import { CampaignPrice } from "./campaign";
import styles from "./suncare.module.css";

export function ProductSelector({ products, error, previewOnly = false }: { products: CatalogProduct[]; error?: string; previewOnly?: boolean }) {
  const sorted = [...products].sort((a, b) => a.variant.units_per_pack - b.variant.units_per_pack || a.sort_order - b.sort_order);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sorted.find(p => p.variant.id === selectedId) || sorted[0];
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = heading.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5)
        timer = setTimeout(() => trackCommerce("view_shop", {}, "view_shop"), 1000);
    }, { threshold: [0, 0.5, 1] });
    observer.observe(node);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);
  return <section id="tienda" className={styles.shop} aria-labelledby="shop-title">
    <div className={styles.sectionHeading} ref={heading}>
      <div><p className={styles.eyebrow}>Tu próxima rutina empieza aquí</p><h2 id="shop-title">Elige tu Luzela.</h2></div>
      <p>Una para ti. Dos para compartir.<br />Tres para que no falte.</p>
    </div>
    {!selected ? <p role="status" className={styles.emptyState}>{error ? "No pudimos cargar el catálogo en este momento." : "El catálogo no está disponible por el momento."} <Link href="/?retry=catalog#tienda" prefetch={false}>Volver a intentar</Link></p> : <>
      <fieldset className={styles.packOptions}>
        <legend className="sr-only">Selecciona tu presentación</legend>
        {sorted.map(product => <label key={product.variant.id} className={styles.packOption} data-selected={selected.variant.id === product.variant.id}>
          <input type="radio" name="luzela-presentation" value={product.variant.id} checked={selected.variant.id === product.variant.id}
            onChange={() => setSelectedId(product.variant.id)} aria-label={`${product.name}, ${product.variant.units_per_pack} piezas`} />
          <span className={styles.packOptionTop}><strong>{product.variant.units_per_pack}X</strong><Check size={16} aria-hidden /></span>
          <span>{formatMoney(product.variant.effective_price_cents, product.variant.currency)}</span>
          <small>{product.variant.stock_on_hand > 0 ? product.variant.unit_price_label : "Agotado"}</small>
        </label>)}
      </fieldset>
      <FunnelProductView key={selected.variant.id} productId={selected.id} sku={selected.variant.sku}
        summerPack={selected.variant.analytics_item_id.startsWith("summer_") ? `${selected.variant.units_per_pack}x` : undefined}
        featured={selected.variant.units_per_pack === 3} className={styles.selectedProduct}>
        <div className={styles.productStage}>
          <Image src="/luzela/v4/sunlight-shadows.webp" alt="" fill sizes="(max-width: 767px) 100vw, 50vw" className={styles.stageBackground} />
          {selected.variant.analytics_item_id.startsWith("summer_") || !selected.image_url
            ? <BottleComposition units={selected.variant.units_per_pack} />
            : <Image src={selected.image_url} alt={selected.name} width={400} height={500} sizes="(max-width: 767px) 65vw, 400px" className={styles.catalogImage} />}
          <p>{selected.variant.units_per_pack} {selected.variant.units_per_pack === 1 ? "pieza" : "piezas"} · Protección mineral</p>
        </div>
        <div className={styles.productDetails}>
          <div aria-live="polite" aria-atomic="true">
            <p className={styles.eyebrow}>{selected.variant.badge || "Tu compañero de todos los días"}</p>
            <h3>{selected.name}</h3><p className={styles.variantName}>{selected.variant.name}</p>
            <CampaignPrice product={selected} />
            <p className={styles.unitPrice}>{selected.variant.unit_price_label || `${formatMoney(selected.variant.price_per_unit_cents, selected.variant.currency)} por pieza`}</p>
            {selected.variant.offer_active && selected.variant.discount_cents > 0 ? <p className={styles.savings}>Descuento vigente: {formatMoney(selected.variant.discount_cents, selected.variant.currency)}</p> : null}
            {selected.description ? <p className={styles.productDescription}>{selected.description}</p> : null}
            <p className={styles.stock} data-available={selected.variant.stock_on_hand > 0}><span />{previewOnly ? "Disponibilidad de referencia; no en tiempo real" : selected.variant.stock_label}</p>
          </div>
          <div className={styles.purchaseButton}>{previewOnly ? <button type="button" disabled>Preview · Compra deshabilitada</button> : <AddToCartButton product={selected} featured />}</div>
          <p className={styles.shippingNote}><Truck size={17} aria-hidden />{selected.free_shipping ? "Envío incluido" : "Costo de envío confirmado en checkout"}</p>
          <p className={styles.checkoutNote}>{previewOnly ? "Esta vista permite revisar el diseño. No crea pedidos ni procesa pagos." : "Continúa al carrito para revisar tu pedido. Pago seguro con Mercado Pago."}</p>
        </div>
      </FunnelProductView>
    </>}
  </section>;
}

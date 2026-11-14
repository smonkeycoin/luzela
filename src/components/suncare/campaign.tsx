import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";
import { isSummerDropProduct } from "@/lib/catalog/summer-drop";
import { BottleComposition } from "./bottle-composition";
import styles from "./suncare.module.css";

export function CampaignRibbon({ children }: { children: React.ReactNode }) {
  return <p className={styles.campaignRibbon}>{children}</p>;
}

/** Display values arrive from getActiveProducts; no client promotional pricing. */
export function CampaignPrice({ product }: { product: CatalogProduct }) {
  const { variant } = product;
  return <div className={styles.campaignPrice}>
    <span>{formatMoney(variant.effective_price_cents, variant.currency)}</span><small>MXN</small>
    {variant.offer_active && variant.effective_price_cents < variant.price_cents
      ? <del aria-label={`Precio regular ${formatMoney(variant.price_cents, variant.currency)}`}>{formatMoney(variant.price_cents, variant.currency)}</del> : null}
  </div>;
}

export function CampaignCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={styles.button}>{children}<ArrowUpRight size={16} aria-hidden /></Link>;
}

export function CampaignFeature({ product, concept = false, previewOnly = false }: { product?: CatalogProduct; concept?: boolean; previewOnly?: boolean }) {
  if (!concept && (!product || !isSummerDropProduct(product))) return null;
  return <section id={concept ? "campaign-concept" : "summer-drop"} className={styles.campaign}
    aria-label={concept ? "Vista conceptual Buen Fin" : "Summer Drop"} data-campaign-mode={concept ? "concept" : "active"}>
    <div className={styles.campaignCopy}>
      <CampaignRibbon>{concept ? "Buen Fin · Vista conceptual" : "Summer Drop · Edición limitada"}</CampaignRibbon>
      <h2>{concept ? <>El verano no termina.<br /><em>Los precios bajan.</em></> : <>Más días de sol.<br /><em>Más para compartir.</em></>}</h2>
      {concept ? <p>Una nueva edición está por tomar forma. Promoción aún no activa: precios y fechas pendientes de autorización.</p>
        : <><p className={styles.campaignOffer}>Paga 2. Recibe 3.</p><p>La misma protección mineral, para compartir tus días favoritos.</p></>}
    </div>
    <div className={styles.campaignProduct}><BottleComposition units={3} /></div>
    <div className={styles.campaignCommerce}>
      {concept ? <><span className={styles.eyebrow}>Concepto de campaña</span><p>Sin oferta de compra promocional.</p></>
        : product ? <><span className={styles.eyebrow}>{product.variant.units_per_pack} Luzelas</span><CampaignPrice product={product} />
          <p>{product.free_shipping ? "Envío incluido" : "Envío calculado en checkout"}</p>
          {previewOnly ? <p>Oferta de referencia. Compra deshabilitada en este Preview.</p> : <CampaignCTA href="/summer-drop">Descubrir Summer Drop</CampaignCTA>}
          <small>Hasta agotar existencias. No acumulable con otros descuentos.</small></> : null}
    </div>
  </section>;
}

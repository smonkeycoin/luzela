import type { CatalogProduct } from "@/lib/catalog/types";
export type Promo = {
  id: string;
  code: string;
  status: string;
  discount_type: string;
  percent_off: number | null;
  collaborator_id: string;
  eligible_variant_ids: string[];
  minimum_subtotal_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  deleted_at: string | null;
  max_redemptions: number | null;
  per_customer_limit: number | null;
  allowed_customer_emails: string[];
};
export function validatePromo(
  promo: Promo | null,
  product: CatalogProduct,
  quantity: number,
  now = new Date(),
) {
  if (
    !promo ||
    promo.status !== "active" ||
    promo.deleted_at ||
    promo.discount_type !== "percent" ||
    !promo.percent_off ||
    promo.percent_off > 100
  )
    return "Este código no está disponible.";
  if (
    (promo.starts_at && now < new Date(promo.starts_at)) ||
    (promo.ends_at && now >= new Date(promo.ends_at))
  )
    return "Este código está fuera de vigencia.";
  if (
    product.variant.units_per_pack >= 10 ||
    !promo.eligible_variant_ids.includes(product.variant.id)
  )
    return "Este código no aplica a este pack.";
  if (product.variant.offer_active)
    return "Este pack ya tiene una oferta. Los beneficios no se acumulan.";
  if (
    product.variant.effective_price_cents * quantity <
    promo.minimum_subtotal_cents
  )
    return "No se alcanza el mínimo de compra para este código.";
  return null;
}
export function discountAmount(subtotal: number, percent: number) {
  return Math.round((subtotal * percent) / 100);
}

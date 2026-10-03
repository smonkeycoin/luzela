import type { CatalogProduct } from "./types";

export const SUMMER_DROP = {
  campaign: "summer_drop",
  ref: "summerdrop",
  sku: "LUZ-SUMMER-3X",
  regularPriceCents: 81_900,
  discountCents: 5_000,
  priceCents: 76_900,
  unitsPerPack: 3,
} as const;

export function isSummerDropSku(product: Pick<CatalogProduct, "slug" | "variant">) {
  return product.variant.sku === SUMMER_DROP.sku ||
    (product.slug === "summer-3x" && product.variant.units_per_pack === 3);
}

export function isSummerDropProduct(product: Pick<CatalogProduct, "slug" | "variant">) {
  return isSummerDropSku(product) && product.variant.offer_active === true &&
    product.variant.price_cents === SUMMER_DROP.regularPriceCents &&
    product.variant.offer_price_cents === SUMMER_DROP.priceCents;
}

export function applySummerDropPricing(product: CatalogProduct, active: boolean): CatalogProduct {
  if (!active || !isSummerDropSku(product)) return product;

  return {
    ...product,
    free_shipping: true,
    variant: {
      ...product.variant,
      price_cents: SUMMER_DROP.regularPriceCents,
      offer_price_cents: SUMMER_DROP.priceCents,
      offer_active: true,
      effective_price_cents: SUMMER_DROP.priceCents,
      price_per_unit_cents: Math.round(SUMMER_DROP.priceCents / SUMMER_DROP.unitsPerPack),
      discount_cents: SUMMER_DROP.discountCents,
      unit_price_label: "$256.33 c/u",
      badge: "SUMMER DROP",
      secondary_headline: "Paga 2. Recibe 3.",
    },
  };
}

export type SummerDropAvailability = {
  active: boolean;
  allocation: number;
  paid_packs: number;
  reserved_packs: number;
  remaining_packs: number;
} | null;

export async function getSummerDropAvailability(db: unknown): Promise<SummerDropAvailability> {
  try {
    const client = db as { rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }> };
    const { data, error } = await client.rpc("get_summer_drop_availability");
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return null;
    const value = row as Record<string, unknown>;
    return {
      active: value.active === true,
      allocation: Number(value.allocation || 0),
      paid_packs: Number(value.paid_packs || 0),
      reserved_packs: Number(value.reserved_packs || 0),
      remaining_packs: Number(value.remaining_packs || 0),
    };
  } catch {
    return null;
  }
}

import { describe, expect, it } from "vitest";

import type { CatalogProduct } from "./types";
import { applySummerDropPricing, isSummerDropProduct, SUMMER_DROP } from "./summer-drop";

const product = {
  id: "p3",
  slug: "summer-3x",
  name: "SUMMER 3X",
  description: null,
  category: null,
  free_shipping: true,
  sort_order: 30,
  image_url: "/luzela/bottle.webp",
  variant: {
    id: "v3", sku: "LUZ-SUMMER-3X", name: "3 Luzelas", price_cents: 81900,
    compare_at_price_cents: null, offer_price_cents: 76900, offer_active: true,
    effective_price_cents: 76900, price_per_unit_cents: 25633, discount_cents: 5000,
    currency: "mxn", stock_on_hand: 8, physical_stock_on_hand: 24,
    stock_label: "Disponible", units_per_pack: 3, inventory_variant_id: "base",
    analytics_item_id: "summer_3x", unit_price_label: "$273 c/u", badge: null,
    secondary_headline: null,
  },
} satisfies CatalogProduct;

describe("Summer Drop pricing", () => {
  it("keeps the regular 3X price and applies the temporary $50 promotion", () => {
    expect(SUMMER_DROP.regularPriceCents).toBe(81900);
    const offer = applySummerDropPricing(product, true);
    expect(offer.variant.price_cents).toBe(81900);
    expect(offer.variant.effective_price_cents).toBe(76900);
    expect(offer.variant.discount_cents).toBe(5000);
    expect(offer.variant.price_per_unit_cents).toBe(25633);
  });

  it("only identifies the 3X campaign SKU", () => {
    expect(isSummerDropProduct(product)).toBe(true);
    expect(isSummerDropProduct({ ...product, slug: "summer-2x", variant: { ...product.variant, sku: "LUZ-SUMMER-2X", units_per_pack: 2 } })).toBe(false);
  });
});

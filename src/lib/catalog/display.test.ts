import { describe, expect, it } from "vitest";

import {
  canShowProductInStorefront,
  getInventoryStatus,
  getInventoryStatusLabel,
  hasSellableVariant,
} from "./display";

describe("catalog display control", () => {
  it("requires active, visible products with at least one priced active variant", () => {
    expect(
      canShowProductInStorefront({
        status: "active",
        is_visible: true,
        product_variants: [{ status: "active", price_cents: 45900 }],
      }),
    ).toBe(true);

    expect(
      canShowProductInStorefront({
        status: "active",
        is_visible: false,
        product_variants: [{ status: "active", price_cents: 45900 }],
      }),
    ).toBe(false);

    expect(
      canShowProductInStorefront({
        status: "active",
        is_visible: true,
        product_variants: [{ status: "inactive", price_cents: 45900 }],
      }),
    ).toBe(false);

    expect(
      canShowProductInStorefront({
        status: "active",
        is_visible: true,
        product_variants: [{ status: "active", price_cents: 0 }],
      }),
    ).toBe(false);
  });

  it("keeps hidden products admin-manageable even when they are not sellable", () => {
    expect(
      hasSellableVariant({
        status: "active",
        is_visible: false,
        product_variants: [{ status: "inactive", price_cents: 0 }],
      }),
    ).toBe(false);
  });

  it("classifies per-SKU stock using product-level thresholds", () => {
    expect(getInventoryStatus({ stock: 4, lowStockThreshold: 2 })).toBe("available");
    expect(getInventoryStatus({ stock: 2, lowStockThreshold: 2 })).toBe("low_stock");
    expect(getInventoryStatus({ stock: 0, lowStockThreshold: 2 })).toBe("out_of_stock");

    expect(getInventoryStatusLabel("available")).toBe("Disponible");
    expect(getInventoryStatusLabel("low_stock")).toBe("Stock bajo");
    expect(getInventoryStatusLabel("out_of_stock")).toBe("Agotado");
  });
});

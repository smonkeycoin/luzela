import { describe, expect, it } from "vitest";

import {
  getDiscountCents,
  getEffectivePriceCents,
  getPricePerUnitCents,
  isOfferEnabled,
} from "./pricing";

describe("catalog offer pricing", () => {
  it("uses original price when offer is inactive", () => {
    const pricing = {
      price_cents: 89000,
      offer_price_cents: 69000,
      offer_active: false,
    };

    expect(isOfferEnabled(pricing)).toBe(false);
    expect(getEffectivePriceCents(pricing)).toBe(89000);
    expect(getDiscountCents(pricing)).toBe(0);
  });

  it("uses offer price when active and lower than original", () => {
    const pricing = {
      price_cents: 89000,
      offer_price_cents: 69000,
      offer_active: true,
    };

    expect(isOfferEnabled(pricing)).toBe(true);
    expect(getEffectivePriceCents(pricing)).toBe(69000);
    expect(getDiscountCents(pricing)).toBe(20000);
  });

  it("rejects ineffective offers by falling back to original price", () => {
    expect(
      getEffectivePriceCents({
        price_cents: 89000,
        offer_price_cents: 89000,
        offer_active: true,
      }),
    ).toBe(89000);
  });

  it("calculates price per unit dynamically", () => {
    expect(getPricePerUnitCents(81900, 3)).toBe(27300);
    expect(getPricePerUnitCents(76900, 2)).toBe(38450);
  });
});

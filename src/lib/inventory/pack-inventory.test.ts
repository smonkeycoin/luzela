import { describe, expect, it } from "vitest";

import { applySaleMovementOnce } from "./ledger";
import { getAvailablePacks, getPhysicalUnitsRequired } from "../catalog/pack";

describe("pack inventory semantics", () => {
  it("converts commercial pack quantity to physical units", () => {
    expect(getPhysicalUnitsRequired(1, 1)).toBe(1);
    expect(getPhysicalUnitsRequired(1, 2)).toBe(2);
    expect(getPhysicalUnitsRequired(1, 3)).toBe(3);
    expect(getPhysicalUnitsRequired(1, 10)).toBe(10);
    expect(getPhysicalUnitsRequired(2, 3)).toBe(6);
    expect(getPhysicalUnitsRequired(2, 10)).toBe(20);
  });

  it("derives pack availability from physical stock", () => {
    expect(getAvailablePacks(2, 1)).toBe(2);
    expect(getAvailablePacks(2, 2)).toBe(1);
    expect(getAvailablePacks(2, 3)).toBe(0);
    expect(getAvailablePacks(5, 3)).toBe(1);
    expect(getAvailablePacks(9, 10)).toBe(0);
    expect(getAvailablePacks(10, 10)).toBe(1);
    expect(getAvailablePacks(21, 10)).toBe(2);
  });

  it("applies physical unit movement once for duplicate webhook keys", () => {
    const first = applySaleMovementOnce(
      { stockOnHand: 10, appliedMovementKeys: new Set() },
      getPhysicalUnitsRequired(1, 3),
      "sale:summer-3x",
    );
    const duplicate = applySaleMovementOnce(first, 3, "sale:summer-3x");

    expect(first.stockOnHand).toBe(7);
    expect(duplicate.stockOnHand).toBe(7);
  });

  it("rejects a concurrent final-stock attempt without going negative", () => {
    const first = applySaleMovementOnce(
      { stockOnHand: 3, appliedMovementKeys: new Set() },
      getPhysicalUnitsRequired(1, 3),
      "sale:first",
    );

    expect(first.stockOnHand).toBe(0);
    expect(() =>
      applySaleMovementOnce(first, getPhysicalUnitsRequired(1, 3), "sale:second"),
    ).toThrow("Insufficient stock.");
  });

  it("preserves old order semantics with units_per_pack fallback of 1", () => {
    const packQuantity = 2;
    const unitsPerPack = 1;

    expect(getPhysicalUnitsRequired(packQuantity, unitsPerPack)).toBe(2);
  });
});

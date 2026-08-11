import { describe, expect, it } from "vitest";

import { applySaleMovementOnce } from "./ledger";

describe("inventory ledger idempotency", () => {
  it("applies a sale movement exactly once for a key", () => {
    const first = applySaleMovementOnce(
      { stockOnHand: 10, appliedMovementKeys: new Set() },
      2,
      "sale:order-1:variant-1",
    );
    const duplicate = applySaleMovementOnce(first, 2, "sale:order-1:variant-1");

    expect(first.stockOnHand).toBe(8);
    expect(duplicate.stockOnHand).toBe(8);
    expect(duplicate.appliedMovementKeys.size).toBe(1);
  });

  it("rejects insufficient stock", () => {
    expect(() =>
      applySaleMovementOnce(
        { stockOnHand: 1, appliedMovementKeys: new Set() },
        2,
        "sale:order-2:variant-1",
      ),
    ).toThrow("Insufficient stock.");
  });
});

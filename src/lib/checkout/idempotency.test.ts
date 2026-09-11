import { describe, expect, it } from "vitest";

import {
  createAttemptSignature,
  isSameAttemptSignature,
  stableJson,
} from "./idempotency";

describe("checkout idempotency helpers", () => {
  it("creates deterministic signatures independent of object key order", () => {
    const first = createAttemptSignature({
      amount_cents: 39000,
      customer: { email: "client@example.com", name: "Luz" },
      items: [{ quantity: 1, variant: "summer-1x" }],
    });
    const second = createAttemptSignature({
      items: [{ variant: "summer-1x", quantity: 1 }],
      customer: { name: "Luz", email: "client@example.com" },
      amount_cents: 39000,
    });

    expect(first).toBe(second);
    expect(stableJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("detects same-key different logical operations", () => {
    const signature = createAttemptSignature({
      amount_cents: 39000,
      variant: "summer-1x",
    });
    const changedSignature = createAttemptSignature({
      amount_cents: 69000,
      variant: "summer-3x",
    });

    expect(isSameAttemptSignature({ attempt_signature: signature }, signature)).toBe(true);
    expect(isSameAttemptSignature({ attempt_signature: signature }, changedSignature)).toBe(false);
  });

  it("allows legacy metadata without a stored signature to be reused safely", () => {
    const signature = createAttemptSignature({ amount_cents: 39000 });

    expect(isSameAttemptSignature({}, signature)).toBe(true);
    expect(isSameAttemptSignature(null, signature)).toBe(true);
  });
});

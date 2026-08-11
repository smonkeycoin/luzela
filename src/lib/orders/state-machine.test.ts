import { describe, expect, it } from "vitest";

import { canTransitionOrder } from "./state-machine";

describe("order state machine", () => {
  it("allows the happy fulfillment path", () => {
    expect(canTransitionOrder("draft", "pending_payment")).toBe(true);
    expect(canTransitionOrder("pending_payment", "paid")).toBe(true);
    expect(canTransitionOrder("paid", "preparing")).toBe(true);
    expect(canTransitionOrder("preparing", "ready_to_ship")).toBe(true);
    expect(canTransitionOrder("ready_to_ship", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
  });

  it("blocks invalid payment and fulfillment jumps", () => {
    expect(canTransitionOrder("draft", "paid")).toBe(false);
    expect(canTransitionOrder("pending_payment", "shipped")).toBe(false);
    expect(canTransitionOrder("delivered", "preparing")).toBe(false);
    expect(canTransitionOrder("cancelled", "paid")).toBe(false);
  });
});

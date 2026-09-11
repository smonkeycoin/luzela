import { describe, expect, it } from "vitest";

import {
  assertInventoryWillNotGoNegative,
  assertValidOfferPricing,
  canMarkDelivered,
  canMarkPreparing,
  derivePackAvailability,
  escapeCsvCell,
  formatMexicoDayKey,
  formatTimeInState,
  getAnalyticsRangeStart,
  getAverageOrderValueCents,
  getCustomerSegment,
  getShippingActionCounts,
  getShippingPriority,
  getShippingProblems,
  mapManualMovementType,
  matchesOrderFilter,
  matchesShippingView,
  normalizeInventoryDelta,
  isValidPaidOrder,
  isValidShippingTrackingNumber,
  parsePriceCents,
  rowsToCsv,
  sortShippingQueue,
} from "./operations";

describe("admin operations", () => {
  it("validates price edits as positive integer cents", () => {
    const form = new FormData();
    form.set("price", "391");

    expect(parsePriceCents(form.get("price"))).toBe(39100);
    form.set("price", "0");
    expect(() => parsePriceCents(form.get("price"))).toThrow("price_must_be_positive");
  });

  it("rejects invalid active offers", () => {
    expect(() =>
      assertValidOfferPricing({
        originalPriceCents: 89000,
        offerPriceCents: 0,
        offerActive: true,
      }),
    ).toThrow("offer_price_invalid");
    expect(() =>
      assertValidOfferPricing({
        originalPriceCents: 89000,
        offerPriceCents: 89000,
        offerActive: true,
      }),
    ).toThrow("offer_price_must_be_lower_than_original");
  });

  it("derives commercial availability from one physical stock pool", () => {
    expect(derivePackAvailability(5)).toEqual({
      oneX: 5,
      twoX: 2,
      threeX: 1,
    });
  });

  it("maps requested admin movement labels onto current ledger enum safely", () => {
    expect(mapManualMovementType("RECEIPT")).toBe("purchase");
    expect(mapManualMovementType("SAMPLE")).toBe("manual_correction");
    expect(normalizeInventoryDelta("DAMAGE", 2)).toBe(-2);
    expect(normalizeInventoryDelta("RECEIPT", 100)).toBe(100);
  });

  it("blocks negative stock from manual inventory adjustments", () => {
    expect(() => assertInventoryWillNotGoNegative(1, -2)).toThrow(
      "inventory_negative_not_allowed",
    );
    expect(() => assertInventoryWillNotGoNegative(1, -1)).not.toThrow();
  });

  it("allows preparing only after payment authority has marked the order paid", () => {
    expect(
      canMarkPreparing({
        payment_status: "paid",
        fulfillment_status: "unfulfilled",
        status: "paid",
      }),
    ).toBe(true);
    expect(
      canMarkPreparing({
        payment_status: "requires_payment",
        fulfillment_status: "unfulfilled",
        status: "pending_payment",
      }),
    ).toBe(false);
  });

  it("allows delivered only from a paid shipped order", () => {
    expect(
      canMarkDelivered({
        payment_status: "paid",
        fulfillment_status: "shipped",
        status: "shipped",
      }),
    ).toBe(true);
    expect(
      canMarkDelivered({
        payment_status: "paid",
        fulfillment_status: "preparing",
        status: "preparing",
      }),
    ).toBe(false);
  });

  it("filters order rows by operational status", () => {
    const paidOrder = {
      payment_status: "paid",
      fulfillment_status: "unfulfilled",
      status: "paid",
    };

    expect(matchesOrderFilter(paidOrder, "attention")).toBe(true);
    expect(matchesOrderFilter(paidOrder, "to_prepare")).toBe(true);
    expect(matchesOrderFilter(paidOrder, "preparing")).toBe(false);
    expect(
      matchesOrderFilter(
        {
          payment_status: "paid",
          fulfillment_status: "delivered",
          status: "delivered",
        },
        "delivered",
      ),
    ).toBe(true);
  });

  it("classifies customers using objective paid-order segments", () => {
    expect(getCustomerSegment({ paidOrders: 1, lifetimeSpendCents: 39000 })).toBe("new");
    expect(getCustomerSegment({ paidOrders: 3, lifetimeSpendCents: 169000 })).toBe("returning");
    expect(getCustomerSegment({ paidOrders: 4, lifetimeSpendCents: 200000 })).toBe("vip");
    expect(
      getCustomerSegment({
        paidOrders: 1,
        lifetimeSpendCents: 500000,
        vipSpendThresholdCents: 500000,
      }),
    ).toBe("vip");
  });

  it("calculates AOV from paid revenue and valid paid orders only", () => {
    expect(getAverageOrderValueCents(178000, 2)).toBe(89000);
    expect(getAverageOrderValueCents(0, 0)).toBe(0);
    expect(isValidPaidOrder({ payment_status: "paid", status: "paid" })).toBe(true);
    expect(isValidPaidOrder({ payment_status: "failed", status: "draft" })).toBe(false);
    expect(isValidPaidOrder({ payment_status: "paid", status: "cancelled" })).toBe(false);
    expect(
      isValidPaidOrder({
        payment_status: "paid",
        status: "refunded",
        refunded_at: "2026-08-13T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("builds analytics ranges and Mexico day keys deterministically", () => {
    const now = new Date("2026-08-13T16:00:00.000Z");

    expect(getAnalyticsRangeStart("7d", now).toISOString()).toBe("2026-08-07T06:00:00.000Z");
    expect(formatMexicoDayKey("2026-08-13T05:59:00.000Z")).toBe("2026-08-12");
    expect(formatMexicoDayKey("2026-08-13T06:00:00.000Z")).toBe("2026-08-13");
  });

  it("exports operational CSV without breaking commas or quotes", () => {
    expect(escapeCsvCell('Luzela, "VIP"')).toBe('"Luzela, ""VIP"""');
    expect(
      rowsToCsv([
        {
          name: "trino",
          email: "trinopc1@gmail.com",
          orders: 1,
        },
      ]),
    ).toBe("name,email,orders\ntrino,trinopc1@gmail.com,1\n");
  });

  it("counts shipping actions from one operational definition", () => {
    const now = new Date("2026-08-13T18:00:00.000Z");
    const sla = { prepareAttentionHours: 24, shippingAttentionHours: 48 };
    const rows = [
      {
        payment_status: "paid",
        fulfillment_status: "unfulfilled",
        status: "paid",
        created_at: "2026-08-13T12:00:00.000Z",
        paid_at: "2026-08-13T12:00:00.000Z",
      },
      {
        payment_status: "paid",
        fulfillment_status: "preparing",
        status: "preparing",
        created_at: "2026-08-13T10:00:00.000Z",
        state_started_at: "2026-08-13T10:00:00.000Z",
      },
      {
        payment_status: "paid",
        fulfillment_status: "shipped",
        status: "shipped",
        created_at: "2026-08-12T10:00:00.000Z",
        shipped_at: "2026-08-13T08:00:00.000Z",
        tracking_number: "ABC12345",
        email_status: "failed",
      },
      {
        payment_status: "paid",
        fulfillment_status: "delivered",
        status: "delivered",
        created_at: "2026-08-11T10:00:00.000Z",
        shipped_at: "2026-08-12T10:00:00.000Z",
        delivered_at: "2026-08-13T10:00:00.000Z",
      },
    ];

    expect(getShippingActionCounts(rows, sla, now)).toEqual({
      attention: 3,
      toPrepare: 1,
      preparing: 1,
      needsGuide: 1,
      shipped: 1,
      delivered: 1,
      problems: 1,
      all: 4,
    });
  });

  it("prioritizes shipping queue by problems, missing guide, then preparation", () => {
    const now = new Date("2026-08-13T18:00:00.000Z");
    const sla = { prepareAttentionHours: 24, shippingAttentionHours: 48 };
    const rows = [
      {
        id: "to_prepare",
        payment_status: "paid",
        fulfillment_status: "unfulfilled",
        status: "paid",
        created_at: "2026-08-13T12:00:00.000Z",
      },
      {
        id: "problem",
        payment_status: "paid",
        fulfillment_status: "shipped",
        status: "shipped",
        created_at: "2026-08-13T09:00:00.000Z",
        email_status: "failed",
        tracking_number: "ABC12345",
      },
      {
        id: "needs_guide",
        payment_status: "paid",
        fulfillment_status: "preparing",
        status: "preparing",
        created_at: "2026-08-13T10:00:00.000Z",
      },
    ];

    expect(rows.map((row) => getShippingPriority(row, sla, now))).toEqual([2, 0, 1]);
    expect(sortShippingQueue(rows, sla, now).map((row) => row.id)).toEqual([
      "problem",
      "needs_guide",
      "to_prepare",
    ]);
  });

  it("detects malformed tracking, SLA attention, and invalid fulfillment states", () => {
    const now = new Date("2026-08-13T18:00:00.000Z");
    const sla = { prepareAttentionHours: 24, shippingAttentionHours: 48 };

    expect(isValidShippingTrackingNumber("ABC-12345")).toBe(true);
    expect(isValidShippingTrackingNumber("abc 12345")).toBe(true);
    expect(isValidShippingTrackingNumber("bad/123")).toBe(false);
    expect(formatTimeInState("2026-08-13T16:30:00.000Z", now)).toBe("Hace 2 h");

    const problems = getShippingProblems(
      {
        payment_status: "paid",
        fulfillment_status: "preparing",
        status: "preparing",
        created_at: "2026-08-10T10:00:00.000Z",
        state_started_at: "2026-08-10T10:00:00.000Z",
        tracking_number: "bad/123",
      },
      sla,
      now,
    );

    expect(problems.map((problem) => problem.code)).toEqual([
      "tracking_malformed",
      "preparing_sla",
    ]);
    expect(
      matchesShippingView(
        {
          payment_status: "paid",
          fulfillment_status: "mystery",
          status: "paid",
          created_at: "2026-08-13T10:00:00.000Z",
        },
        "problems",
        sla,
        now,
      ),
    ).toBe(true);
  });
});

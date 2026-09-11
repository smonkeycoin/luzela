import { describe, it, expect, vi } from "vitest";
import { captureAttribution } from "@/lib/attribution";
import {
  validatePromo,
  discountAmount,
  type Promo,
} from "./promo";
import type { CatalogProduct } from "@/lib/catalog/types";
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
import { reportRange, salesCsv, type SafeSale } from "./report";
const promo = {
  id: "p",
  code: "TEST-COLLAB10",
  status: "active",
  discount_type: "percent",
  percent_off: 10,
  eligible_variant_ids: ["v"],
  minimum_subtotal_cents: 0,
  starts_at: null,
  ends_at: null,
  deleted_at: null,
} as Promo;
const product = {
  variant: {
    id: "v",
    units_per_pack: 1,
    effective_price_cents: 45900,
    offer_active: false,
  },
} as CatalogProduct;
describe("collaboration pricing and attribution", () => {
  it("discounts merchandise in integer cents without touching shipping", () => {
    const discount = discountAmount(45900, 10);
    expect(discount).toBe(4590);
    expect(45900 - discount + 18900).toBe(60210);
    expect(discountAmount(33333, 10)).toBe(3333);
  });
  it("rejects inactive, expired, upcoming, ineligible and stacked offers", () => {
    expect(validatePromo(promo, product, 1)).toBeNull();
    for (const override of [
      { status: "inactive" },
      { ends_at: "2000-01-01" },
      { starts_at: "2100-01-01" },
      { eligible_variant_ids: [] },
      { minimum_subtotal_cents: 70000 },
    ])
      expect(validatePromo({ ...promo, ...override }, product, 1)).toBeTruthy();
    expect(
      validatePromo(
        promo,
        { ...product, variant: { ...product.variant, offer_active: true } },
        1,
      ),
    ).toContain("acumulan");
    expect(
      validatePromo(
        promo,
        { ...product, variant: { ...product.variant, units_per_pack: 10 } },
        1,
      ),
    ).toBeTruthy();
  });
  it("keeps referral context independently of coupon redemption", () => {
    const attr = captureAttribution(null, {
      url: "https://www.luzela.mx/?ref=chavolines&utm_content=story_01&email=private@example.com",
    });
    expect(attr.first_touch.source).toBe("elmundoenpareja");
    expect(attr.first_touch.content).toBe("story_01");
    expect(JSON.stringify(attr)).not.toContain("private@example.com");
  });
  it("preserves first touch and campaign on internal navigation", () => {
    const first = captureAttribution(null, {
      url: "https://luzela.mx/?utm_source=meta",
    });
    const second = captureAttribution(first, {
      url: "https://luzela.mx/chavolines",
    });
    const checkout = captureAttribution(second, {
      url: "https://luzela.mx/checkout?variant=123",
    });
    expect(checkout.first_touch.source).toBe("meta");
    expect(checkout.collab_touch?.campaign).toBe("luzela_x_chavolines");
  });
  it("uses Cancun date boundaries and rejects bad custom ranges", () => {
    expect(
      reportRange({ range: "today" }, new Date("2026-09-11T02:00:00Z")),
    ).toMatchObject({
      since_at: "2026-09-10T05:00:00.000Z",
      until_at: "2026-09-11T05:00:00.000Z",
    });
    expect(() =>
      reportRange({ range: "custom", from: "2026-09-11", to: "2026-09-10" }),
    ).toThrow();
  });
  it("exports only approved fields and neutralizes spreadsheet formulas", () => {
    const csv = salesCsv([
      {
        date: "2026-09-10",
        order_number: "LZ-TEST",
        product: "=EVIL()",
        units: 1,
        gross_merchandise: 69000,
        discount: 6900,
        net_merchandise: 62100,
        status: "paid",
        customer_email: "private@example.com",
      } as unknown as SafeSale,
    ]);
    expect(csv).toContain("'=EVIL()");
    expect(csv).toContain("621.00");
    expect(csv).not.toContain("private@example.com");
    expect(csv).not.toContain("shipping");
  });
});

it("preserves an explicit referral even when UTM campaign differs and a later channel is visited", () => {
  const first = captureAttribution(null, { url: "https://www.luzela.mx/" });
  const collab = captureAttribution(first, {
    url: "https://www.luzela.mx/?ref=chavolines&utm_source=instagram&utm_campaign=custom_story",
  });
  const later = captureAttribution(collab, {
    url: "https://www.luzela.mx/?utm_source=email&utm_campaign=followup",
  });
  expect(collab.last_touch.campaign).toBe("custom_story");
  expect(collab.last_touch.ref).toBe("chavolines");
  expect(later.last_touch.campaign).toBe("followup");
  expect(later.collab_touch?.ref).toBe("chavolines");
});

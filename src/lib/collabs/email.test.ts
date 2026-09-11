import { expect, it } from "vitest";
import { renderOrderConfirmationEmail } from "@/lib/email/templates/order-confirmation";
it("customer email separates frozen discount, shipping and collected total", () => {
  const email = renderOrderConfirmationEmail({
    orderNumber: "LZ-TEST",
    createdAt: "2026-09-10T12:00:00Z",
    totalCents: 81000,
    subtotalCents: 69000,
    discountCents: 6900,
    discountCode: "TEST-COLLAB10",
    discountPercent: 10,
    shippingCents: 18900,
    currency: "mxn",
    carrierDisplayName: "DHL",
    items: [],
  });
  expect(email.text).toContain("TEST-COLLAB10");
  expect(email.text).toContain("10%");
  expect(email.text).toContain("69.00");
  expect(email.text).toContain("189.00");
  expect(email.text).toContain("810.00");
  expect(email.html).toContain("TEST-COLLAB10");
});

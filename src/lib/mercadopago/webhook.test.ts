import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { verifyMercadoPagoWebhookSignature } from "./webhook";

function sign({
  dataId,
  secret,
  timestamp,
  xRequestId,
}: {
  dataId: string;
  secret: string;
  timestamp: string;
  xRequestId: string;
}) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${timestamp};`;

  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("Mercado Pago webhook signature", () => {
  it("accepts a valid x-signature manifest", () => {
    const dataId = "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3";
    const secret = "test-webhook-secret";
    const timestamp = "1742505638683";
    const xRequestId = "2066ca19-c6f1-498a-be75-1923005edd06";
    const signature = sign({ dataId, secret, timestamp, xRequestId });

    expect(
      verifyMercadoPagoWebhookSignature({
        dataId,
        secret,
        xRequestId,
        xSignature: `ts=${timestamp},v1=${signature}`,
      }),
    ).toBe(true);
  });

  it("rejects a wrong amount/order manifest signature", () => {
    const secret = "test-webhook-secret";
    const timestamp = "1742505638683";
    const xRequestId = "2066ca19-c6f1-498a-be75-1923005edd06";
    const signature = sign({
      dataId: "ORD01VALID",
      secret,
      timestamp,
      xRequestId,
    });

    expect(
      verifyMercadoPagoWebhookSignature({
        dataId: "ORD01SPOOFED",
        secret,
        xRequestId,
        xSignature: `ts=${timestamp},v1=${signature}`,
      }),
    ).toBe(false);
  });
});

import { createHmac, timingSafeEqual } from "crypto";

export function verifyMercadoPagoWebhookSignature({
  dataId,
  secret,
  xRequestId,
  xSignature,
}: {
  dataId: string;
  secret: string;
  xRequestId: string;
  xSignature: string;
}) {
  const parts = new Map(
    xSignature
      .split(",")
      .map((part) => part.split("=", 2))
      .filter((part): part is [string, string] => part.length === 2)
      .map(([key, value]) => [key.trim(), value.trim()]),
  );
  const timestamp = parts.get("ts");
  const signature = parts.get("v1");

  if (!timestamp || !signature || !secret) {
    return false;
  }

  const manifestParts = [];

  if (dataId) {
    manifestParts.push(`id:${dataId.toLowerCase()}`);
  }

  if (xRequestId) {
    manifestParts.push(`request-id:${xRequestId}`);
  }

  manifestParts.push(`ts:${timestamp}`);

  const computed = createHmac("sha256", secret)
    .update(`${manifestParts.join(";")};`)
    .digest("hex");
  const expected = Buffer.from(signature, "hex");
  const actual = Buffer.from(computed, "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

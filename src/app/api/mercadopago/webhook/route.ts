import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { processMercadoPagoWebhook } from "@/lib/mercadopago/process-event";
import { getMercadoPagoWebhookSecret } from "@/lib/mercadopago/client";
import { verifyMercadoPagoWebhookSignature } from "@/lib/mercadopago/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = getMercadoPagoWebhookSecret();
  const headerList = await headers();
  const xSignature = headerList.get("x-signature") || "";
  const xRequestId = headerList.get("x-request-id") || "";
  const url = new URL(request.url);
  const payload = await request.json().catch(() => ({}));
  const payloadDataId =
    typeof payload?.data?.id === "string" ? payload.data.id : "";
  const dataId = url.searchParams.get("data.id") || payloadDataId;

  if (!secret || !xSignature || !xRequestId || !dataId) {
    return NextResponse.json(
      { error: "mercadopago_webhook_not_configured" },
      { status: 501 },
    );
  }

  const valid = verifyMercadoPagoWebhookSignature({
    dataId,
    secret,
    xRequestId,
    xSignature,
  });

  if (!valid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  await processMercadoPagoWebhook({ dataId, payload });

  return NextResponse.json({ received: true });
}

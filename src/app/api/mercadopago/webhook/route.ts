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
  const dataId = url.searchParams.get("data.id") || "";

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

  const payload = await request.json();
  await processMercadoPagoWebhook({ dataId, payload });

  return NextResponse.json({ received: true });
}

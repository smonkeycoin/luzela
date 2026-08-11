import { Resend } from "resend";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ShippingEmailData = {
  orderId: string;
  shipmentId: string;
  orderNumber: string;
  email: string;
  firstName?: string | null;
  trackingNumber: string;
  trackingUrl: string;
};

export async function sendShippingConfirmationEmail(data: ShippingEmailData) {
  const supabase = createSupabaseAdminClient();
  const idempotencyKey = `shipping_confirmation:${data.orderId}:${data.shipmentId}`;

  const { data: existingEvent } = supabase
    ? await supabase
        .from("email_events")
        .select("id, status, provider_message_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle()
    : { data: null };

  if (existingEvent?.status === "sent") {
    return { sent: false, skipped: true, reason: "already_sent" };
  }

  if (existingEvent) {
    return { sent: false, skipped: true, reason: "already_recorded" };
  }

  const payload = {
    orderId: data.orderId,
    shipmentId: data.shipmentId,
    orderNumber: data.orderNumber,
    email: data.email,
    firstName: data.firstName,
    trackingNumber: data.trackingNumber,
    trackingUrl: data.trackingUrl,
  };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Luzela <orders@luzela.mx>";

  if (!apiKey) {
    await supabase?.from("email_events").insert({
      order_id: data.orderId,
      template_key: "order_shipped",
      status: "skipped",
      idempotency_key: idempotencyKey,
      error_message: "RESEND_API_KEY is not configured.",
      payload,
    });
    return { sent: false, skipped: true, reason: "resend_not_configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: data.email,
      subject: "Tu Luzela ya va en camino",
      html: renderShippingEmail(data),
    });

    await supabase?.from("email_events").insert({
      order_id: data.orderId,
      template_key: "order_shipped",
      status: result.error ? "failed" : "sent",
      provider_message_id: result.data?.id,
      idempotency_key: idempotencyKey,
      error_message: result.error?.message,
      payload,
      sent_at: result.error ? null : new Date().toISOString(),
    });

    return {
      sent: !result.error,
      failed: Boolean(result.error),
      id: result.data?.id,
      error: result.error?.message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend request failed.";

    await supabase?.from("email_events").insert({
      order_id: data.orderId,
      template_key: "order_shipped",
      status: "failed",
      idempotency_key: idempotencyKey,
      error_message: message,
      payload,
    });

    return { sent: false, failed: true, error: message };
  }
}

function renderShippingEmail(data: ShippingEmailData) {
  const firstName = data.firstName || "cliente";

  return `
    <div style="margin:0;background:#f7f3ea;padding:32px 16px;font-family:Montserrat,Arial,sans-serif;color:#1f1a17;">
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">
        Tu pedido fue enviado. Aquí está tu guía DHL.
      </div>
      <div style="max-width:560px;margin:0 auto;background:#fffaf0;border:1px solid #e4dccf;padding:32px;">
        <p style="margin:0 0 24px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#147b75;font-weight:700;">Luzela</p>
        <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;font-weight:700;color:#1f1a17;">Tu Luzela ya va en camino.</h1>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Hola ${escapeHtml(firstName)},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">Tu pedido #${escapeHtml(data.orderNumber)} ya fue enviado.</p>
        <div style="margin:0 0 24px;padding:18px;border:1px solid #e4dccf;background:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#147b75;font-weight:700;">DHL</p>
          <p style="margin:0 0 8px;font-size:13px;color:#6d625a;">Número de guía:</p>
          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.04em;color:#1f1a17;">${escapeHtml(data.trackingNumber)}</p>
        </div>
        <a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;margin:0 0 22px;background:#147b75;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:14px;font-weight:700;">Rastrear mi pedido</a>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#6d625a;">El tiempo estimado de entrega es de 2 a 5 días hábiles, dependiendo del destino.</p>
        <p style="margin:0;font-size:14px;line-height:1.7;">Gracias por elegir Luzela.</p>
        <div style="margin-top:32px;padding-top:18px;border-top:1px solid #e4dccf;color:#6d625a;font-size:12px;line-height:1.6;">
          <p style="margin:0;">Luzela México</p>
          <p style="margin:0;">luzela.mx</p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

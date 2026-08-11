import { Resend } from "resend";

import { formatMoney } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderEmailData = {
  orderId: string;
  orderNumber: string;
  email: string;
  totalCents: number;
  currency: string;
};

export async function sendOrderConfirmedEmail(data: OrderEmailData) {
  const supabase = createSupabaseAdminClient();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Luzela <orders@luzela.mx>";

  if (!apiKey) {
    await supabase?.from("email_events").insert({
      order_id: data.orderId,
      template_key: "payment_confirmed",
      status: "skipped",
      error_message: "RESEND_API_KEY is not configured.",
      payload: data,
    });
    return { sent: false, reason: "resend_not_configured" };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: data.email,
    subject: "Pedido confirmado Luzela",
    html: `
      <div style="font-family: Montserrat, Arial, sans-serif; color: #171310;">
        <h1>Pedido confirmado Luzela</h1>
        <p>Gracias por tu compra. Tu pago fue confirmado correctamente.</p>
        <p><strong>Orden:</strong> ${data.orderNumber}</p>
        <p><strong>Total:</strong> ${formatMoney(data.totalCents, data.currency)}</p>
      </div>
    `,
  });

  await supabase?.from("email_events").insert({
    order_id: data.orderId,
    template_key: "payment_confirmed",
    status: result.error ? "failed" : "sent",
    provider_message_id: result.data?.id,
    error_message: result.error?.message,
    payload: data,
    sent_at: result.error ? null : new Date().toISOString(),
  });

  return { sent: !result.error, id: result.data?.id };
}

import { sendOrderConfirmedEmail } from "@/lib/email/send-order-confirmed";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function confirmProviderPaidOrder({
  checkoutSessionId,
  orderId,
  paymentEventId,
  paymentIntentId,
}: {
  orderId: string;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  paymentEventId: string;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role is not configured.");

  const { data: beforeOrder } = await supabase
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();

  const { error } = await supabase.rpc("confirm_paid_order", {
    p_order_id: orderId,
    p_stripe_checkout_session_id: checkoutSessionId,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (error) {
    throw error;
  }

  await supabase
    .from("payment_events")
    .update({ order_id: orderId })
    .eq("id", paymentEventId);

  if (beforeOrder?.payment_status !== "paid") {
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_number, total_cents, currency, customers(email)")
      .eq("id", orderId)
      .single();

    const customer = Array.isArray(order?.customers)
      ? order?.customers[0]
      : order?.customers;
    const email = customer?.email;

    if (order && email) {
      await sendOrderConfirmedEmail({
        orderId,
        orderNumber: order.order_number as string,
        email: email as string,
        totalCents: order.total_cents as number,
        currency: order.currency as string,
      });
    }
  }
}

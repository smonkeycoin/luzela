import { sendAdminOrderAlertEmail } from "@/lib/email/send-admin-order-alert";
import { sendOrderConfirmedEmail } from "@/lib/email/send-order-confirmed";
import { syncCustomerPaidOrderStats } from "@/lib/customers/sync-customer-stats";
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
      .select("id, customer_id")
      .eq("id", orderId)
      .single();

    if (order?.customer_id) {
      await syncCustomerPaidOrderStats(order.customer_id as string);
    }

    if (order) {
      const emailResult = await sendOrderConfirmedEmail({ orderId });

      await supabase.from("audit_log").insert({
        action: emailResult.sent
          ? "order_confirmation_email_sent"
          : "order_confirmation_email_failed",
        table_name: "orders",
        row_id: orderId,
        after_data: {
          sent: emailResult.sent,
          status: emailResult.sent ? "sent" : emailResult.failed ? "failed" : "skipped",
          reason: emailResult.reason || null,
          email_event_id: emailResult.eventId || null,
        },
      });

      try {
        const adminAlertResult = await sendAdminOrderAlertEmail({ orderId });

        await supabase.from("audit_log").insert({
          action: adminAlertResult.reason
            ? "admin_order_alert_skipped"
            : adminAlertResult.failed > 0
              ? "admin_order_alert_failed"
              : "admin_order_alert_sent",
          table_name: "orders",
          row_id: orderId,
          after_data: {
            sent: adminAlertResult.sent,
            failed: adminAlertResult.failed,
            skipped: adminAlertResult.skipped,
            reason: adminAlertResult.reason || null,
            email_event_ids: adminAlertResult.results
              .map((result) => result.eventId)
              .filter(Boolean),
          },
        });
      } catch (adminAlertError) {
        await supabase.from("audit_log").insert({
          action: "admin_order_alert_failed",
          table_name: "orders",
          row_id: orderId,
          after_data: {
            sent: 0,
            failed: 1,
            skipped: 0,
            reason:
              adminAlertError instanceof Error
                ? adminAlertError.message
                : "admin_order_alert_error",
          },
        });
      }
    }
  }
}

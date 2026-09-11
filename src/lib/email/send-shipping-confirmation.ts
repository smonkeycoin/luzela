import {
  EMAIL_EVENT_TYPES,
  sendTransactionalEmail,
  type TransactionalEmailResult,
} from "@/lib/email/transactional";
import { renderShippingConfirmationEmail } from "@/lib/email/templates/shipping-confirmation";
import { getShippingPolicy } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ShippingEmailData = {
  orderId: string;
  shipmentId: string;
  orderNumber: string;
  email: string;
  firstName?: string | null;
  trackingNumber: string;
  trackingUrl: string;
  retryEventId?: string;
};

export async function sendShippingConfirmationEmail(
  data: ShippingEmailData,
): Promise<TransactionalEmailResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { sent: false, skipped: true, reason: "supabase_not_configured" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, order_items(name, physical_units, quantity, units_per_pack)")
    .eq("id", data.orderId)
    .maybeSingle();
  const items = (Array.isArray(order?.order_items) ? order?.order_items : []).map((item) => ({
    name: item.name,
    physicalUnits: Number(
      item.physical_units || Number(item.quantity || 0) * Number(item.units_per_pack || 1),
    ),
  }));
  const shippingPolicy = await getShippingPolicy();
  const rendered = renderShippingConfirmationEmail({
    orderNumber: data.orderNumber,
    firstName: data.firstName,
    carrier: shippingPolicy.carrierDisplayName,
    minDays: shippingPolicy.minDays,
    maxDays: shippingPolicy.maxDays,
    businessDays: shippingPolicy.businessDays,
    trackingNumber: data.trackingNumber,
    trackingUrl: data.trackingUrl,
    items,
  });

  return sendTransactionalEmail({
    eventType: EMAIL_EVENT_TYPES.SHIPPING_CONFIRMATION,
    orderId: data.orderId,
    customerId: order?.customer_id || null,
    recipient: data.email,
    subject: "Tu Luzela ya va en camino",
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: `shipping_confirmation:${data.shipmentId}`,
    retryEventId: data.retryEventId,
    payload: {
      order_number: data.orderNumber,
      shipment_id: data.shipmentId,
      carrier: shippingPolicy.carrierDisplayName,
      tracking_number: data.trackingNumber,
      shipping_min_days: shippingPolicy.minDays,
      shipping_max_days: shippingPolicy.maxDays,
      item_count: items.length,
    },
  });
}

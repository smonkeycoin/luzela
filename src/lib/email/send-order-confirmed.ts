import {
  EMAIL_EVENT_TYPES,
  sendTransactionalEmail,
  type TransactionalEmailResult,
} from "@/lib/email/transactional";
import { renderOrderConfirmationEmail } from "@/lib/email/templates/order-confirmation";
import { getShippingPolicy } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUMMER_DROP } from "@/lib/catalog/summer-drop";

type OrderEmailInput = {
  orderId: string;
  retryEventId?: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  discount_cents?: number;
  discount_code?: string | null;
  discount_value?: number | null;
  metadata?: Record<string, unknown> | null;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  customer_id: string | null;
  customers:
    | {
        email: string;
        first_name: string | null;
      }
    | {
        email: string;
        first_name: string | null;
      }[]
    | null;
  customer_addresses:
    | {
        full_name: string | null;
        line1: string | null;
        line2: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        country: string | null;
      }
    | {
        full_name: string | null;
        line1: string | null;
        line2: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        country: string | null;
      }[]
    | null;
  order_items:
    | Array<{
        name: string;
        quantity: number;
        units_per_pack: number | null;
        physical_units: number | null;
        unit_price_cents: number;
        subtotal_cents: number;
      }>
    | null;
};

export async function sendOrderConfirmedEmail(
  input: OrderEmailInput,
): Promise<TransactionalEmailResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { sent: false, skipped: true, reason: "supabase_not_configured" };
  }

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, created_at, subtotal_cents, discount_cents, discount_code, discount_value, shipping_cents, total_cents, currency, customer_id, metadata, customers(email, first_name), customer_addresses(full_name, line1, line2, neighborhood, city, state, postal_code, country), order_items(name, quantity, units_per_pack, physical_units, unit_price_cents, subtotal_cents)",
    )
    .eq("id", input.orderId)
    .maybeSingle();

  const order = data as OrderRow | null;
  const customer = Array.isArray(order?.customers)
    ? order?.customers[0]
    : order?.customers;
  const address = Array.isArray(order?.customer_addresses)
    ? order?.customer_addresses[0]
    : order?.customer_addresses;

  if (!order || !customer?.email) {
    return { sent: false, skipped: true, reason: "recipient_missing" };
  }

  const summerDropOrder = (order.metadata?.promotion as { name?: string } | undefined)?.name === "SUMMER_DROP";
  const items = (order.order_items || []).map((item) => ({
    name: summerDropOrder ? "SUMMER DROP · 3 Luzelas · Paga 2. Recibe 3." : item.name,
    quantity: Number(item.quantity || 0),
    unitsPerPack: Number(item.units_per_pack || 1),
    physicalUnits: Number(
      item.physical_units || Number(item.quantity || 0) * Number(item.units_per_pack || 1),
    ),
    unitPriceCents: summerDropOrder ? SUMMER_DROP.regularPriceCents : Number(item.unit_price_cents || 0),
    subtotalCents: summerDropOrder
      ? SUMMER_DROP.regularPriceCents * Number(item.quantity || 0)
      : Number(item.subtotal_cents || 0),
  }));
  const shippingPolicy = await getShippingPolicy();
  const rendered = renderOrderConfirmationEmail({
    orderNumber: order.order_number,
    createdAt: order.created_at,
    firstName: customer.first_name,
    totalCents: Number(order.total_cents || 0),
    subtotalCents: Number(order.subtotal_cents || 0),
    discountCents: Number(order.discount_cents || 0),
    discountCode: order.discount_code,
    discountLabel: (order.metadata?.promotion as { name?: string } | undefined)?.name === "SUMMER_DROP"
      ? "Descuento SUMMER DROP"
      : undefined,
    discountPercent: order.discount_value,
    shippingCents: Number(order.shipping_cents || 0),
    currency: order.currency,
    carrierDisplayName: shippingPolicy.carrierDisplayName,
    items,
    shippingAddress: address,
  });

  return sendTransactionalEmail({
    eventType: EMAIL_EVENT_TYPES.ORDER_CONFIRMATION,
    orderId: order.id,
    customerId: order.customer_id,
    recipient: customer.email,
    subject: "Recibimos tu pedido Luzela",
    html: rendered.html,
    text: rendered.text,
    idempotencyKey: `order_confirmation:${order.id}`,
    retryEventId: input.retryEventId,
    payload: {
      order_number: order.order_number,
      total_cents: order.total_cents,
      currency: order.currency,
      item_count: items.length,
    },
  });
}

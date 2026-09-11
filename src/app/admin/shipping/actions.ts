"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/admin";
import { canMarkDelivered, canMarkPreparing } from "@/lib/admin/operations";
import {
  DHL_CARRIER,
  getDhlTrackingUrl,
  isValidDhlTrackingNumber,
  normalizeDhlTrackingNumber,
} from "@/lib/fulfillment/dhl";
import { sendShippingConfirmationEmail } from "@/lib/email/send-shipping-confirmation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ShippingOrder = {
  id: string;
  order_number: string;
  payment_status: string;
  status: string;
  fulfillment_status: string;
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
};

function shippingRedirect(params: Record<string, string>): never {
  const query = new URLSearchParams(params);

  redirect(`/admin/shipping?${query.toString()}`);
}

function getShippingSupabaseOrRedirect(view: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    shippingRedirect({ view, result: "error", reason: "backend" });
  }

  return supabase;
}

export async function markShippingPreparing(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = getShippingSupabaseOrRedirect("attention");

  if (adminSession.admin.role === "readonly") {
    shippingRedirect({ view: "attention", result: "error", reason: "role" });
  }

  if (formData.get("confirm") !== "yes") {
    shippingRedirect({ view: "attention", result: "error", reason: "confirm" });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_status, fulfillment_status, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    shippingRedirect({ view: "attention", result: "error", reason: "order" });
  }

  if (!canMarkPreparing(order)) {
    shippingRedirect({ view: "attention", result: "error", reason: "transition" });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "preparing", fulfillment_status: "preparing" })
    .eq("id", orderId);

  if (error) {
    shippingRedirect({ view: "attention", result: "error", reason: "save" });
  }

  await insertShippingAudit({
    action: "fulfillment_preparing",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      from: order,
      to: { status: "preparing", fulfillment_status: "preparing" },
      actor_email: adminSession.admin.email,
    },
  });

  revalidateShipping(orderId);
  shippingRedirect({ view: "preparing", result: "preparing" });
}

export async function shipShippingOrder(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = getShippingSupabaseOrRedirect("attention");

  if (adminSession.admin.role === "readonly") {
    shippingRedirect({ view: "attention", result: "error", reason: "role" });
  }

  if (formData.get("confirm") !== "yes") {
    shippingRedirect({ view: "preparing", result: "error", reason: "confirm" });
  }

  const trackingNumber = normalizeDhlTrackingNumber(String(formData.get("tracking_number") || ""));

  if (!isValidDhlTrackingNumber(trackingNumber)) {
    shippingRedirect({ view: "preparing", result: "error", reason: "tracking" });
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, payment_status, status, fulfillment_status, customer_id, customers(email, first_name)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    shippingRedirect({ view: "preparing", result: "error", reason: "order" });
  }

  const typedOrder = order as ShippingOrder;

  if (
    typedOrder.payment_status !== "paid" ||
    typedOrder.status === "cancelled" ||
    typedOrder.status === "refunded" ||
    typedOrder.fulfillment_status !== "preparing"
  ) {
    shippingRedirect({ view: "preparing", result: "error", reason: "transition" });
  }

  const trackingUrl = getDhlTrackingUrl();
  const { data: shipmentId, error: shipmentError } = await supabase.rpc("mark_order_shipped", {
    p_order_id: orderId,
    p_tracking_number: trackingNumber,
    p_tracking_url: trackingUrl,
    p_actor_user_id: adminSession.user.id,
  });

  if (shipmentError || !shipmentId) {
    shippingRedirect({
      view: "preparing",
      result: "error",
      reason: shipmentError?.message?.includes("already") ? "duplicate" : "shipment",
    });
  }

  const customer = Array.isArray(typedOrder.customers)
    ? typedOrder.customers[0]
    : typedOrder.customers;
  let emailState = "skipped";

  if (customer?.email) {
    const emailResult = await sendShippingConfirmationEmail({
      orderId,
      shipmentId: shipmentId as string,
      orderNumber: typedOrder.order_number,
      email: customer.email,
      firstName: customer.first_name,
      trackingNumber,
      trackingUrl,
    });

    emailState = emailResult.sent ? "sent" : emailResult.failed ? "failed" : "skipped";

    await insertShippingAudit({
      action: emailResult.sent ? "shipping_email_sent" : "shipping_email_failed",
      actorUserId: adminSession.user.id,
      orderId,
      data: {
        shipment_id: shipmentId,
        carrier: DHL_CARRIER,
        tracking_number: trackingNumber,
        result: emailState,
        reason: emailResult.reason || null,
        actor_email: adminSession.admin.email,
      },
    });
  } else {
    emailState = "failed";
    await insertShippingAudit({
      action: "shipping_email_failed",
      actorUserId: adminSession.user.id,
      orderId,
      data: { shipment_id: shipmentId, reason: "customer_email_missing" },
    });
  }

  revalidateShipping(orderId);
  shippingRedirect({ view: "shipped", result: "shipped", emailResult: emailState });
}

export async function markShippingDelivered(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = getShippingSupabaseOrRedirect("shipped");

  if (adminSession.admin.role === "readonly") {
    shippingRedirect({ view: "shipped", result: "error", reason: "role" });
  }

  if (formData.get("confirm") !== "yes") {
    shippingRedirect({ view: "shipped", result: "error", reason: "confirm" });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_status, fulfillment_status, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    shippingRedirect({ view: "shipped", result: "error", reason: "order" });
  }

  if (!canMarkDelivered(order)) {
    shippingRedirect({ view: "shipped", result: "error", reason: "transition" });
  }

  const deliveredAt = new Date().toISOString();
  const shipmentResult = await supabase
    .from("shipments")
    .update({ status: "delivered", delivered_at: deliveredAt })
    .eq("order_id", orderId)
    .eq("status", "shipped");

  if (shipmentResult.error) {
    shippingRedirect({ view: "shipped", result: "error", reason: "shipment" });
  }

  const updateResult = await supabase
    .from("orders")
    .update({ status: "delivered", fulfillment_status: "delivered" })
    .eq("id", orderId);

  if (updateResult.error) {
    shippingRedirect({ view: "shipped", result: "error", reason: "save" });
  }

  await insertShippingAudit({
    action: "fulfillment_delivered",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      delivered_at: deliveredAt,
      actor_email: adminSession.admin.email,
    },
  });

  revalidateShipping(orderId);
  shippingRedirect({ view: "delivered", result: "delivered" });
}

export async function retryShippingEmail(orderId: string, emailEventId: string) {
  const adminSession = await requireAdminSession();
  const supabase = getShippingSupabaseOrRedirect("problems");

  if (adminSession.admin.role !== "owner" && adminSession.admin.role !== "admin") {
    shippingRedirect({ view: "problems", result: "error", reason: "role" });
  }

  const { data: event } = await supabase
    .from("email_events")
    .select("id, order_id, template_key, event_type, status")
    .eq("id", emailEventId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (!event) {
    shippingRedirect({ view: "problems", result: "error", reason: "event" });
  }

  if (event.status === "sent") {
    shippingRedirect({ view: "problems", result: "error", reason: "sent" });
  }

  const eventType = String(event.event_type || event.template_key);

  if (eventType !== "SHIPPING_CONFIRMATION" && eventType !== "order_shipped") {
    shippingRedirect({ view: "problems", result: "error", reason: "type" });
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, customers(email, first_name), shipments(id, tracking_number, tracking_url, status, shipped_at)",
    )
    .eq("id", orderId)
    .maybeSingle();
  const customer = Array.isArray(order?.customers) ? order?.customers[0] : order?.customers;
  const shipments = Array.isArray(order?.shipments) ? order?.shipments : [];
  const shipment = shipments.find((item) => item.status === "shipped") || shipments[0];

  if (!order || !customer?.email || !shipment?.id || !shipment?.tracking_number) {
    shippingRedirect({ view: "problems", result: "error", reason: "context" });
  }

  const result = await sendShippingConfirmationEmail({
    orderId,
    shipmentId: shipment.id,
    orderNumber: order.order_number,
    email: customer.email,
    firstName: customer.first_name,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url || getDhlTrackingUrl(),
    retryEventId: emailEventId,
  });

  await insertShippingAudit({
    action: result.sent ? "shipping_email_retried" : "shipping_email_failed",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      email_event_id: emailEventId,
      sent: result.sent,
      status: result.sent ? "sent" : result.failed ? "failed" : "skipped",
      actor_email: adminSession.admin.email,
    },
  });

  revalidateShipping(orderId);
  shippingRedirect({
    view: result.sent ? "shipped" : "problems",
    result: "email_retry",
    emailResult: result.sent ? "sent" : result.failed ? "failed" : "skipped",
  });
}

function revalidateShipping(orderId: string) {
  revalidatePath("/admin/shipping");
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

async function insertShippingAudit({
  action,
  actorUserId,
  orderId,
  data,
}: {
  action: string;
  actorUserId: string;
  orderId: string;
  data: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();

  await supabase?.from("audit_log").insert({
    actor_user_id: actorUserId,
    action,
    table_name: "orders",
    row_id: orderId,
    after_data: data,
  });
}

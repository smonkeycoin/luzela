"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  DHL_CARRIER,
  getDhlTrackingUrl,
  isValidDhlTrackingNumber,
  normalizeDhlTrackingNumber,
} from "@/lib/fulfillment/dhl";
import { requireAdminSession } from "@/lib/auth/admin";
import { canMarkDelivered, canMarkPreparing } from "@/lib/admin/operations";
import { sendShippingConfirmationEmail } from "@/lib/email/send-shipping-confirmation";
import { sendOrderConfirmedEmail } from "@/lib/email/send-order-confirmed";
import { reconcilePayment } from "@/lib/payments/reconcile-payment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrderForShipping = {
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

export async function markOrderShipped(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect(`/admin/orders/${orderId}?shipping=error&reason=backend`);
  }

  if (adminSession.admin.role === "readonly") {
    redirect(`/admin/orders/${orderId}?shipping=error&reason=role`);
  }

  const trackingNumber = normalizeDhlTrackingNumber(
    String(formData.get("tracking_number") || ""),
  );

  if (!isValidDhlTrackingNumber(trackingNumber)) {
    redirect(`/admin/orders/${orderId}?shipping=error&reason=tracking`);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, payment_status, status, fulfillment_status, customer_id, customers(email, first_name)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    redirect(`/admin/orders/${orderId}?shipping=error&reason=order`);
  }

  const typedOrder = order as OrderForShipping;

  if (
    typedOrder.payment_status !== "paid" ||
    typedOrder.status === "cancelled" ||
    typedOrder.status === "refunded" ||
    typedOrder.fulfillment_status === "cancelled" ||
    typedOrder.fulfillment_status === "shipped" ||
    typedOrder.fulfillment_status === "delivered"
  ) {
    redirect(`/admin/orders/${orderId}?shipping=error&reason=transition`);
  }

  const trackingUrl = getDhlTrackingUrl();
  const { data: shipmentId, error: shipmentError } = await supabase.rpc(
    "mark_order_shipped",
    {
      p_order_id: orderId,
      p_tracking_number: trackingNumber,
      p_tracking_url: trackingUrl,
      p_actor_user_id: adminSession.user.id,
    },
  );

  if (shipmentError || !shipmentId) {
    const reason = shipmentError?.message?.includes("already")
      ? "duplicate"
      : "shipment";
    redirect(`/admin/orders/${orderId}?shipping=error&reason=${reason}`);
  }

  const customer = Array.isArray(typedOrder.customers)
    ? typedOrder.customers[0]
    : typedOrder.customers;

  if (!customer?.email) {
    await insertAuditLog({
      action: "shipping_email_failed",
      actorUserId: adminSession.user.id,
      orderId,
      data: { shipment_id: shipmentId, reason: "customer_email_missing" },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    redirect(`/admin/orders/${orderId}?shipping=shipped&email=failed`);
  }

  const emailResult = await sendShippingConfirmationEmail({
    orderId,
    shipmentId: shipmentId as string,
    orderNumber: typedOrder.order_number,
    email: customer.email,
    firstName: customer.first_name,
    trackingNumber,
    trackingUrl,
  });

  await insertAuditLog({
    action: emailResult.sent
      ? "shipping_confirmation_email_sent"
      : "shipping_confirmation_email_failed",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      shipment_id: shipmentId,
      carrier: DHL_CARRIER,
      tracking_number: trackingNumber,
      result: emailResult,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  redirect(
    `/admin/orders/${orderId}?shipping=shipped&email=${
      emailResult.sent ? "sent" : emailResult.failed ? "failed" : "skipped"
    }`,
  );
}

export async function markOrderPreparing(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=backend`);
  }

  if (adminSession.admin.role === "readonly") {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=role`);
  }

  if (formData.get("confirm") !== "yes") {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=confirm`);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status, fulfillment_status, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=order`);
  }

  if (!canMarkPreparing(order)) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=transition`);
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "preparing",
      fulfillment_status: "preparing",
    })
    .eq("id", orderId);

  if (updateError) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=save`);
  }

  await insertAuditLog({
    action: "order_marked_preparing",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      from: {
        status: order.status,
        fulfillment_status: order.fulfillment_status,
      },
      to: {
        status: "preparing",
        fulfillment_status: "preparing",
      },
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${orderId}?fulfillment=preparing`);
}

export async function markOrderDelivered(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=backend`);
  }

  if (adminSession.admin.role === "readonly") {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=role`);
  }

  if (formData.get("confirm") !== "yes") {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=confirm`);
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, payment_status, fulfillment_status, status")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=order`);
  }

  if (!canMarkDelivered(order)) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=transition`);
  }

  const deliveredAt = new Date().toISOString();
  const { error: shipmentError } = await supabase
    .from("shipments")
    .update({
      status: "delivered",
      delivered_at: deliveredAt,
    })
    .eq("order_id", orderId)
    .eq("status", "shipped");

  if (shipmentError) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=shipment`);
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      status: "delivered",
      fulfillment_status: "delivered",
    })
    .eq("id", orderId);

  if (updateError) {
    redirect(`/admin/orders/${orderId}?fulfillment=error&reason=save`);
  }

  await insertAuditLog({
    action: "order_marked_delivered",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      delivered_at: deliveredAt,
      from: {
        status: order.status,
        fulfillment_status: order.fulfillment_status,
      },
      to: {
        status: "delivered",
        fulfillment_status: "delivered",
      },
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect(`/admin/orders/${orderId}?fulfillment=delivered`);
}

export async function reconcileMercadoPagoOrder(orderId: string, formData: FormData) {
  const adminSession = await requireAdminSession();

  if (adminSession.admin.role !== "owner" && adminSession.admin.role !== "admin") {
    redirect(`/admin/orders/${orderId}?payment=error&reason=role`);
  }

  if (formData.get("confirm") !== "yes") {
    redirect(`/admin/orders/${orderId}?payment=error&reason=confirm`);
  }

  let redirectPath = `/admin/orders/${orderId}?payment=error&reason=reconcile`;

  try {
    const result = await reconcilePayment(orderId);

    await insertAuditLog({
      action: result.paid ? "payment_reconciled" : "payment_reconciliation_checked",
      actorUserId: adminSession.user.id,
      orderId,
      data: {
        provider: result.provider,
        provider_order_id: result.providerOrderId,
        provider_payment_id: result.providerPaymentId,
        paid: result.paid,
        status: result.status,
        status_detail: result.statusDetail,
        actor_email: adminSession.admin.email,
      },
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    redirectPath = `/admin/orders/${orderId}?payment=${result.paid ? "reconciled" : "not_paid"}`;
  } catch (error) {
    await insertAuditLog({
      action: "payment_reconciliation_failed",
      actorUserId: adminSession.user.id,
      orderId,
      data: {
        reason: error instanceof Error ? error.message : "unknown_error",
        actor_email: adminSession.admin.email,
      },
    });

    revalidatePath(`/admin/orders/${orderId}`);
  }

  redirect(redirectPath);
}

export async function retryTransactionalEmail(orderId: string, emailEventId: string) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect(`/admin/orders/${orderId}?email=error&reason=backend`);
  }

  if (adminSession.admin.role !== "owner" && adminSession.admin.role !== "admin") {
    redirect(`/admin/orders/${orderId}?email=error&reason=role`);
  }

  const { data: event } = await supabase
    .from("email_events")
    .select("id, order_id, template_key, event_type, status")
    .eq("id", emailEventId)
    .eq("order_id", orderId)
    .maybeSingle();

  if (!event) {
    redirect(`/admin/orders/${orderId}?email=error&reason=event`);
  }

  if (event.status === "sent") {
    redirect(`/admin/orders/${orderId}?email=error&reason=sent`);
  }

  const eventType = String(event.event_type || event.template_key);
  let result:
    | Awaited<ReturnType<typeof sendOrderConfirmedEmail>>
    | Awaited<ReturnType<typeof sendShippingConfirmationEmail>>;

  if (eventType === "ORDER_CONFIRMATION" || eventType === "payment_confirmed") {
    result = await sendOrderConfirmedEmail({ orderId, retryEventId: emailEventId });
  } else if (eventType === "SHIPPING_CONFIRMATION" || eventType === "order_shipped") {
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
      redirect(`/admin/orders/${orderId}?email=error&reason=context`);
    }

    result = await sendShippingConfirmationEmail({
      orderId,
      shipmentId: shipment.id,
      orderNumber: order.order_number,
      email: customer.email,
      firstName: customer.first_name,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url || getDhlTrackingUrl(),
      retryEventId: emailEventId,
    });
  } else {
    redirect(`/admin/orders/${orderId}?email=error&reason=type`);
  }

  await insertAuditLog({
    action:
      eventType === "SHIPPING_CONFIRMATION" || eventType === "order_shipped"
        ? result.sent
          ? "shipping_confirmation_email_retried"
          : "shipping_confirmation_email_failed"
        : result.sent
          ? "order_confirmation_email_retried"
          : "order_confirmation_email_failed",
    actorUserId: adminSession.user.id,
    orderId,
    data: {
      email_event_id: emailEventId,
      sent: result.sent,
      status: result.sent ? "sent" : result.failed ? "failed" : "skipped",
      reason: result.reason || null,
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  redirect(`/admin/orders/${orderId}?email=${result.sent ? "sent" : result.failed ? "failed" : "skipped"}`);
}

async function insertAuditLog({
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

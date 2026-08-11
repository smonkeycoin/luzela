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
import { sendShippingConfirmationEmail } from "@/lib/email/send-shipping-confirmation";
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
    action: emailResult.sent ? "shipping_email_sent" : "shipping_email_failed",
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

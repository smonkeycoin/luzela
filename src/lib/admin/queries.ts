import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminOrderRow = {
  id: string;
  order_number: string;
  total_cents: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  customer_email: string;
};

export async function getAdminDashboard() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { metrics: null, error: "Supabase env is not configured." };
  }

  const [ordersResult, itemsResult, inventoryResult, customersResult] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, total_cents, payment_status")
        .order("created_at", { ascending: false }),
      supabase.from("order_items").select("quantity, physical_units, orders(payment_status)"),
      supabase
        .from("inventory")
        .select("stock_on_hand, low_stock_threshold, product_variants(sku, name)"),
      supabase.from("customers").select("id"),
    ]);

  if (ordersResult.error) {
    return { metrics: null, error: ordersResult.error.message };
  }

  const paidOrders = (ordersResult.data || []).filter(
    (order) => order.payment_status === "paid",
  );
  const revenueCents = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const unitsSold = (itemsResult.data || []).reduce((sum, item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.payment_status === "paid"
      ? sum + Number(item.physical_units || item.quantity || 0)
      : sum;
  }, 0);
  const stock = (inventoryResult.data || []).reduce(
    (sum, item) => sum + Number(item.stock_on_hand || 0),
    0,
  );
  const lowStock = (inventoryResult.data || []).filter(
    (item) => Number(item.stock_on_hand) <= Number(item.low_stock_threshold),
  ).length;

  return {
    metrics: {
      orders: ordersResult.data?.length || 0,
      revenueCents,
      unitsSold,
      stock,
      lowStock,
      customers: customersResult.data?.length || 0,
    },
  };
}

export async function getAdminOrders(): Promise<{
  orders: AdminOrderRow[];
  error?: string;
}> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { orders: [], error: "Supabase env is not configured." };
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, total_cents, currency, payment_status, fulfillment_status, created_at, customers(email)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return { orders: [], error: error.message };
  }

  return {
    orders: (data || []).map((order) => {
      const customer = Array.isArray(order.customers)
        ? order.customers[0]
        : order.customers;

      return {
        id: order.id,
        order_number: order.order_number,
        total_cents: order.total_cents,
        currency: order.currency,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        created_at: order.created_at,
        customer_email: customer?.email || "Sin cliente",
      };
    }),
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { order: null, movements: [], error: "Supabase env is not configured." };
  }

  const [orderResult, movementsResult, eventsResult, emailEventsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, customers(email, phone, first_name, last_name), customer_addresses(*), order_items(*), payments(*), shipments(*)",
      )
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity_delta, reason, metadata, created_at, product_variants(sku, name)")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_events")
      .select("id, event_type, processed_at, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_events")
      .select("id, template_key, status, error_message, sent_at, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
  ]);

  if (orderResult.error) {
    return { order: null, movements: [], error: orderResult.error.message };
  }

  return {
    order: orderResult.data,
    movements: movementsResult.data || [],
    events: eventsResult.data || [],
    emailEvents: emailEventsResult.data || [],
    error:
      movementsResult.error?.message ||
      eventsResult.error?.message ||
      emailEventsResult.error?.message,
  };
}

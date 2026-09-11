import { getAvailablePacks, getPrimaryBundleComponent } from "@/lib/catalog/pack";
import { getInventoryStatus } from "@/lib/catalog/display";
import { getDiscountCents, getEffectivePriceCents, getPricePerUnitCents } from "@/lib/catalog/pricing";
import { getAppSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  ADMIN_ORDER_FILTERS,
  formatMexicoDayKey,
  getAttributionOrderSnapshotFromMetadata,
  getAttributionTouchValue,
  getAnalyticsRangeStart,
  getAverageOrderValueCents,
  getCustomerSegment,
  getEstimatedDeliveryCopy,
  getMexicoEndOfDay,
  getMexicoStartOfDay,
  getPreviousRangeStart,
  getShippingActionCounts,
  getShippingProblems,
  getShippingStateStartedAt,
  formatTimeInState,
  isOrderPreparingWithoutGuide,
  isOrderRequiringAttention,
  isOrderToPrepare,
  isValidPaidOrder,
  matchesOrderFilter,
  matchesShippingView,
  parseAnalyticsRange,
  parseCustomerSegment,
  parseCustomerSort,
  parseAttributionTouch,
  parseShippingView,
  rowsToCsv,
  sortShippingQueue,
  type AdminOrderFilter,
  type AdminShippingView,
  type AnalyticsRange,
  type CustomerSegment,
  type CustomerSegmentFilter,
  type CustomerSort,
} from "./operations";

export type AdminOrderRow = {
  id: string;
  customer_id: string | null;
  order_number: string;
  total_cents: number;
  currency: string;
  payment_provider: string;
  payment_status: string;
  fulfillment_status: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  customer_email: string;
  customer_name: string;
  pack_label: string;
  packs: number;
  physical_units: number;
  email_status: string;
  tracking_number: string;
};

export type AdminShippingRow = {
  id: string;
  customer_id: string | null;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_city: string;
  customer_state: string;
  address_lines: string[];
  payment_status: string;
  fulfillment_status: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  state_started_at: string;
  time_in_state: string;
  problem_labels: string[];
  problem_actions: string[];
  product_label: string;
  product_subline: string;
  product_filter: string;
  packs: number;
  physical_units: number;
  total_cents: number;
  currency: string;
  carrier: string;
  shipment_status: string;
  tracking_number: string;
  tracking_url: string;
  shipped_at: string | null;
  delivered_at: string | null;
  email_status: string;
  email_event_id: string | null;
  email_updated_at: string | null;
  estimated_delivery: string;
  timeline: Array<{
    label: string;
    at: string | null;
  }>;
};

export type AdminShippingCounts = ReturnType<typeof getShippingActionCounts>;

export type AdminSearchItem = {
  id: string;
  type: "order" | "customer" | "product";
  label: string;
  description: string;
  href: string;
};

export type AdminDashboardOrder = AdminOrderRow & {
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  customer_phone: string;
  customer_city: string;
  customer_state: string;
  customer_country: string;
  created_label: string;
  product: {
    name: string;
    sku: string;
    quantity: number;
    units_per_pack: number;
    physical_units: number;
    unit_price_cents: number;
    subtotal_cents: number;
  };
  shipment: {
    id: string;
    carrier: string | null;
    status: string;
    tracking_number: string | null;
    tracking_url: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
  } | null;
};

export type AdminOrderCountKey =
  | "all"
  | "attention"
  | "to_prepare"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type AdminNotificationItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "orders" | "shipping" | "email" | "inventory";
};

export type AdminActivityItem = {
  id: string;
  label: string;
  description: string;
  created_at: string;
  href: string;
};

export type AdminProductSales = {
  name: string;
  revenue_cents: number;
  quantity: number;
  percentage: number;
};

export type AdminCustomerRow = {
  id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string;
  city: string;
  state: string;
  paid_orders_count: number;
  lifetime_spend_cents: number;
  average_order_value_cents: number;
  first_order_at: string | null;
  last_order_at: string | null;
  segment: CustomerSegment;
  latest_note: string | null;
};

export type AdminCustomerFilters = {
  q?: string;
  segment?: string;
  sort?: string;
  recent?: string;
};

export type AdminAnalyticsData = {
  range: AnalyticsRange;
  start: string;
  end: string;
  previousStart: string;
  currency: string;
  timezone: string;
  summary: {
    revenue_cents: number;
    previous_revenue_cents: number;
    orders: number;
    previous_orders: number;
    units_sold: number;
    previous_units_sold: number;
    average_order_value_cents: number;
    new_customers: number;
    returning_customers: number;
    repeat_purchase_rate: number;
  };
  salesByDay: Array<{
    day: string;
    revenue_cents: number;
    orders: number;
  }>;
  salesByProduct: Array<{
    name: string;
    sku: string;
    revenue_cents: number;
    orders: number;
    packs_sold: number;
    physical_units: number;
    revenue_percentage: number;
  }>;
  offerPerformance: Array<{
    product: string;
    original_price_cents: number;
    effective_price_cents: number;
    orders_sold: number;
    revenue_cents: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    orders: number;
    lifetime_spend_cents: number;
    last_order_at: string | null;
  }>;
  geography: Array<{
    state: string;
    city: string;
    orders: number;
    revenue_cents: number;
  }>;
  fulfillment: {
    pending: number;
    preparing: number;
    shipped: number;
    delivered: number;
    paid_to_shipped_average_hours: number | null;
  };
  email: {
    order_confirmation_sent: number;
    shipping_confirmation_sent: number;
    failed: number;
    skipped: number;
  };
  inventory: {
    physical_stock: number;
    units_sold_period: number;
    estimated_days_of_stock: number | null;
  };
  failures: {
    failed_payments: number;
    cancelled_orders: number;
    refunds: number;
  };
  attribution: {
    touch: "first" | "last";
    revenue_cents: number;
    orders: number;
    average_order_value_cents: number;
    meta_revenue_percentage: number;
    filters: {
      source: string;
      campaign: string;
      product: string;
    };
    sources: Array<{
      source: string;
      medium: string;
      orders: number;
      revenue_cents: number;
      average_order_value_cents: number;
      revenue_percentage: number;
    }>;
    campaigns: Array<{
      campaign: string;
      source: string;
      orders: number;
      revenue_cents: number;
      average_order_value_cents: number;
      top_product: string;
    }>;
    contents: Array<{
      content: string;
      campaign: string;
      orders: number;
      revenue_cents: number;
      average_order_value_cents: number;
    }>;
    productsByCampaign: Array<{
      campaign: string;
      product: string;
      orders: number;
      physical_units: number;
      revenue_cents: number;
    }>;
  };
};

type VariantRow = {
  id: string;
  sku: string;
  name: string;
  status: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  offer_price_cents: number | null;
  offer_active: boolean;
  currency: string;
  bundle_components?: unknown;
  metadata?: Record<string, unknown> | null;
  updated_at: string;
  inventory?: { stock_on_hand: number; low_stock_threshold: number }[] | null;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  is_visible: boolean;
  free_shipping: boolean;
  sort_order: number;
  updated_at: string;
  product_variants?: VariantRow[] | null;
};

type OrderAttributionRow = {
  order_id: string;
  first_touch_source: string;
  first_touch_medium: string;
  first_touch_campaign: string;
  first_touch_content: string;
  first_touch_term: string;
  first_touch_referrer: string;
  first_touch_landing_path: string;
  first_touch_landing_url: string;
  first_seen_at: string;
  last_touch_source: string;
  last_touch_medium: string;
  last_touch_campaign: string;
  last_touch_content: string;
  last_touch_term: string;
  last_touch_referrer: string;
  last_touch_landing_path: string;
  last_touch_landing_url: string;
  last_seen_at: string;
};

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function formatAdminDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getOrderCustomerName(customer?: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.email || "Sin nombre";
}

function mapLegacyShippingFilter(filter?: string): AdminShippingView {
  if (filter === "needs_guide") {
    return "preparing";
  }

  if (filter === "email_failed") {
    return "problems";
  }

  if (filter === "shipped") {
    return "shipped";
  }

  if (filter === "delivered") {
    return "delivered";
  }

  return "attention";
}

function formatAddressLines(address?: {
  full_name?: string | null;
  line1?: string | null;
  line2?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
} | null) {
  if (!address) {
    return [];
  }

  return [
    address.full_name,
    address.line1,
    address.line2,
    address.neighborhood,
    [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
    address.country,
  ].filter((line): line is string => Boolean(line));
}

function formatShippingProductLabel(
  items: Array<{
    name?: string | null;
    quantity?: number | null;
    physical_units?: number | null;
    units_per_pack?: number | null;
  }>,
) {
  if (items.length === 0) {
    return "Sin producto";
  }

  if (items.length === 1) {
    const item = items[0];
    const quantity = Number(item.quantity || 0);

    return quantity > 1 ? `${quantity} × ${item.name || "Producto"}` : item.name || "Producto";
  }

  return items
    .map((item) => {
      const quantity = Number(item.quantity || 0);

      return quantity > 1 ? `${quantity} × ${item.name || "Producto"}` : item.name || "Producto";
    })
    .join(", ");
}

function getStateStartedAtFromAudit(
  fulfillmentStatus: string,
  audits: Array<{ action: string; created_at: string }>,
) {
  const actionGroups: Record<string, string[]> = {
    preparing: ["order_marked_preparing", "fulfillment_preparing"],
    ready_to_ship: ["order_marked_preparing", "fulfillment_preparing"],
    shipped: ["order_marked_shipped", "shipment_created", "fulfillment_shipped"],
    delivered: ["order_marked_delivered", "fulfillment_delivered"],
    cancelled: ["fulfillment_cancelled"],
  };
  const actions = actionGroups[fulfillmentStatus] || [];

  return audits.find((audit) => actions.includes(audit.action))?.created_at || null;
}

function buildShippingTimeline({
  order,
  shipment,
  shippingEmail,
  audits,
}: {
  order: {
    created_at: string;
    paid_at?: string | null;
  };
  shipment?: {
    tracking_number?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
  } | null;
  shippingEmail?: {
    status?: string | null;
    sent_at?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
  } | null;
  audits: Array<{ action: string; created_at: string }>;
}) {
  const preparingAt = getStateStartedAtFromAudit("preparing", audits);
  const shippedAt = shipment?.shipped_at || getStateStartedAtFromAudit("shipped", audits);
  const deliveredAt = shipment?.delivered_at || getStateStartedAtFromAudit("delivered", audits);

  return [
    { label: "Pedido creado", at: order.created_at },
    { label: "Pago confirmado", at: order.paid_at || null },
    { label: "Inventario descontado", at: getAuditAt(audits, ["inventory_sale", "inventory_decremented"]) },
    { label: "Preparación iniciada", at: preparingAt },
    { label: "Guía agregada", at: shipment?.tracking_number ? shippedAt : null },
    { label: "Enviado", at: shippedAt },
    {
      label:
        shippingEmail?.status === "failed"
          ? "Email falló"
          : shippingEmail?.status === "sent"
            ? "Email enviado"
            : "Email pendiente",
      at: shippingEmail?.sent_at || shippingEmail?.updated_at || shippingEmail?.created_at || null,
    },
    { label: "Entregado", at: deliveredAt },
  ];
}

function getAuditAt(audits: Array<{ action: string; created_at: string }>, actions: string[]) {
  return audits.find((audit) => actions.includes(audit.action))?.created_at || null;
}

function getRelativeTime(value: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
  const [unit, amount] = units.find(([, unitSeconds]) => seconds >= unitSeconds) || ["second", 1];

  return formatter.format(-Math.floor(seconds / amount), unit);
}

function getVariantInventory(variant: VariantRow) {
  const inventory = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;

  return inventory || null;
}

function getVariantUnitsPerPack(variant: Pick<VariantRow, "bundle_components">) {
  return getPrimaryBundleComponent(variant.bundle_components)?.quantity || 1;
}

function getPhysicalInventoryVariantId(variant: Pick<VariantRow, "id" | "bundle_components">) {
  return getPrimaryBundleComponent(variant.bundle_components)?.variant_id || variant.id;
}

export async function getAdminDashboard() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      metrics: null,
      pending: null,
      recentOrders: [],
      orderCounts: {
        all: 0,
        attention: 0,
        to_prepare: 0,
        preparing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      },
      salesByProduct: [],
      activity: [],
      searchItems: [],
      error: "Supabase env is not configured.",
    };
  }

  const today = startOfDay();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [
    settings,
    ordersResult,
    itemsResult,
    inventoryResult,
    emailResult,
    auditResult,
    customersResult,
    productsResult,
  ] = await Promise.all([
    getAppSettings(),
    supabase
      .from("orders")
      .select(
        "id, customer_id, order_number, subtotal_cents, shipping_cents, discount_cents, total_cents, currency, payment_provider, payment_status, fulfillment_status, status, paid_at, created_at, customers(id, email, phone, first_name, last_name), customer_addresses(city, state, country), order_items(name, sku, quantity, units_per_pack, physical_units, unit_price_cents, subtotal_cents), email_events(status, created_at), shipments(id, carrier, status, tracking_number, tracking_url, shipped_at, delivered_at)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("order_items").select("physical_units, orders(payment_status)"),
    supabase
      .from("inventory")
      .select("stock_on_hand, low_stock_threshold, product_variants(sku, name)"),
    supabase.from("email_events").select("id, status, created_at"),
    supabase
      .from("audit_log")
      .select("id, action, table_name, row_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("customers")
      .select("id, email, phone, first_name, last_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("products")
      .select("id, name, product_variants(id, sku, name)")
      .is("deleted_at", null)
      .limit(20),
  ]);

  if (ordersResult.error) {
    return {
      metrics: null,
      pending: null,
      recentOrders: [],
      orderCounts: {
        all: 0,
        attention: 0,
        to_prepare: 0,
        preparing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
      },
      salesByProduct: [],
      activity: [],
      searchItems: [],
      error: ordersResult.error.message,
    };
  }

  const orders = ordersResult.data || [];
  const paidOrders = orders.filter((order) => order.payment_status === "paid");
  const paidToday = paidOrders.filter((order) => {
    const paidAt = order.paid_at || order.created_at;
    return paidAt ? new Date(paidAt) >= today : false;
  });
  const paidYesterday = paidOrders.filter((order) => {
    const paidAt = order.paid_at || order.created_at;
    return paidAt ? new Date(paidAt) >= yesterday && new Date(paidAt) < today : false;
  });
  const paidLast7 = paidOrders.filter((order) => {
    const paidAt = order.paid_at || order.created_at;
    return paidAt ? new Date(paidAt) >= sevenDaysAgo : false;
  });
  const inventoryRows = inventoryResult.data || [];
  const physicalStock = inventoryRows.reduce(
    (sum, item) => sum + Number(item.stock_on_hand || 0),
    0,
  );
  const lowStock = inventoryRows.filter(
    (item) => Number(item.stock_on_hand) <= settings.low_stock_threshold,
  ).length;
  const toPrepare = orders.filter(isOrderToPrepare).length;
  const readyToShip = orders.filter(isOrderPreparingWithoutGuide).length;
  const shipped = paidOrders.filter(
    (order) => order.fulfillment_status === "shipped",
  ).length;
  const failedEmails = (emailResult.data || []).filter(
    (event) => event.status === "failed",
  ).length;
  const revenueCents = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const salesTodayCents = paidToday.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const salesYesterdayCents = paidYesterday.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const unitsSold = (itemsResult.data || []).reduce((sum, item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.payment_status === "paid"
      ? sum + Number(item.physical_units || 0)
      : sum;
  }, 0);
  const orderCounts = orders.reduce(
    (counts, order) => {
      counts.all += 1;

      if (isOrderRequiringAttention(order)) {
        counts.attention += 1;
      }

      if (isOrderToPrepare(order)) {
        counts.to_prepare += 1;
      }

      if (order.fulfillment_status === "preparing" || order.status === "preparing") {
        counts.preparing += 1;
      }

      if (order.fulfillment_status === "shipped" || order.status === "shipped") {
        counts.shipped += 1;
      }

      if (order.fulfillment_status === "delivered" || order.status === "delivered") {
        counts.delivered += 1;
      }

      if (order.status === "cancelled" || order.fulfillment_status === "cancelled") {
        counts.cancelled += 1;
      }

      return counts;
    },
    {
      all: 0,
      attention: 0,
      to_prepare: 0,
      preparing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    } as Record<AdminOrderCountKey, number>,
  );
  const recentOrders: AdminDashboardOrder[] = orders.slice(0, 30).map((order) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const address = Array.isArray(order.customer_addresses)
      ? order.customer_addresses[0]
      : order.customer_addresses;
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const emailEvents = Array.isArray(order.email_events) ? order.email_events : [];
    const latestEmail = [...emailEvents].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    )[0];
    const shipments = Array.isArray(order.shipments) ? order.shipments : [];
    const shipment = shipments[0] || null;
    const firstItem = items[0];
    const productName = firstItem?.name || "Luzela";

    return {
      id: order.id,
      customer_id: order.customer_id,
      order_number: order.order_number,
      subtotal_cents: Number(order.subtotal_cents || 0),
      shipping_cents: Number(order.shipping_cents || 0),
      discount_cents: Number(order.discount_cents || 0),
      total_cents: Number(order.total_cents || 0),
      currency: order.currency,
      payment_provider: order.payment_provider,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      status: order.status,
      created_at: order.created_at,
      paid_at: order.paid_at,
      created_label: formatAdminDate(order.created_at),
      customer_email: customer?.email || "Sin cliente",
      customer_name: getOrderCustomerName(customer),
      customer_phone: customer?.phone || "",
      customer_city: address?.city || "",
      customer_state: address?.state || "",
      customer_country: address?.country || "MX",
      pack_label: productName,
      packs: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      physical_units: items.reduce(
        (sum, item) => sum + Number(item.physical_units || item.quantity || 0),
        0,
      ),
      email_status: latestEmail?.status || "none",
      tracking_number: shipment?.tracking_number || "",
      product: {
        name: productName,
        sku: firstItem?.sku || "",
        quantity: Number(firstItem?.quantity || 0),
        units_per_pack: Number(firstItem?.units_per_pack || 1),
        physical_units: Number(firstItem?.physical_units || firstItem?.quantity || 0),
        unit_price_cents: Number(firstItem?.unit_price_cents || 0),
        subtotal_cents: Number(firstItem?.subtotal_cents || 0),
      },
      shipment,
    };
  });
  const salesMap = new Map<string, { revenue_cents: number; quantity: number }>();

  paidLast7.forEach((order) => {
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    items.forEach((item) => {
      const current = salesMap.get(item.name) || { revenue_cents: 0, quantity: 0 };
      current.revenue_cents += Number(item.subtotal_cents || 0);
      current.quantity += Number(item.quantity || 0);
      salesMap.set(item.name, current);
    });
  });

  const productRevenue = Array.from(salesMap.values()).reduce(
    (sum, item) => sum + item.revenue_cents,
    0,
  );
  const salesByProduct: AdminProductSales[] = Array.from(salesMap.entries())
    .map(([name, item]) => ({
      name,
      revenue_cents: item.revenue_cents,
      quantity: item.quantity,
      percentage: productRevenue ? Math.round((item.revenue_cents / productRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue_cents - a.revenue_cents)
    .slice(0, 4);
  const activityFromAudit: AdminActivityItem[] = (auditResult.data || []).map((event) => ({
    id: event.id,
    label: event.action.replaceAll("_", " "),
    description: `${event.table_name} actualizado ${getRelativeTime(event.created_at)}`,
    created_at: event.created_at,
    href:
      event.table_name === "orders" && event.row_id
        ? `/admin/orders/${event.row_id}`
        : "/admin",
  }));
  const activityFallback: AdminActivityItem[] = recentOrders.slice(0, 5).map((order) => ({
    id: `order-${order.id}`,
    label: `Nueva orden ${order.order_number}`,
    description: `${order.customer_name} · ${getRelativeTime(order.created_at)}`,
    created_at: order.created_at,
    href: `/admin/orders/${order.id}`,
  }));
  const productSearch: AdminSearchItem[] = ((productsResult.data || []) as ProductRow[]).flatMap(
    (product) =>
      (product.product_variants || []).map((variant) => ({
        id: variant.id,
        type: "product" as const,
        label: variant.name || product.name,
        description: variant.sku,
        href: "/admin/products",
      })),
  );
  const customerSearch: AdminSearchItem[] = (customersResult.data || []).map((customer) => ({
    id: customer.id,
    type: "customer",
    label: getOrderCustomerName(customer),
    description: [customer.email, customer.phone].filter(Boolean).join(" · "),
    href: `/admin/customers/${customer.id}`,
  }));
  const orderSearch: AdminSearchItem[] = recentOrders.slice(0, 30).map((order) => ({
    id: order.id,
    type: "order",
    label: order.order_number,
    description: [order.customer_name, order.customer_email, order.tracking_number]
      .filter(Boolean)
      .join(" · "),
    href: `/admin/orders/${order.id}`,
  }));

  return {
    metrics: {
      salesTodayCents,
      salesYesterdayCents,
      salesLast7Cents: paidLast7.reduce(
        (sum, order) => sum + Number(order.total_cents || 0),
        0,
      ),
      paidOrders: paidOrders.length,
      toPrepare,
      shipped,
      physicalStock,
      averageTicketCents: paidOrders.length ? Math.round(revenueCents / paidOrders.length) : 0,
      unitsSold,
    },
    pending: {
      toPrepare,
      readyToShip,
      lowStock,
      failedEmails,
    },
    recentOrders,
    orderCounts,
    salesByProduct,
    activity: activityFromAudit.length ? activityFromAudit : activityFallback,
    searchItems: [...orderSearch, ...customerSearch, ...productSearch],
  };
}

export async function getAdminProducts() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { products: [], error: "Supabase env is not configured." };
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, description, status, is_visible, free_shipping, sort_order, updated_at, product_variants(id, sku, name, status, price_cents, compare_at_price_cents, offer_price_cents, offer_active, currency, bundle_components, metadata, updated_at, inventory(stock_on_hand, low_stock_threshold))",
    )
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    return { products: [], error: error.message };
  }

  const products = ((data || []) as ProductRow[])
    .map((product) => ({
      ...product,
      product_variants: (product.product_variants || [])
        .sort((a, b) => {
          const packOrder = getVariantUnitsPerPack(a) - getVariantUnitsPerPack(b);

          if (packOrder !== 0) {
            return packOrder;
          }

          return a.sku.localeCompare(b.sku);
        }),
    }))
    .filter((product) => product.product_variants.length > 0);

  const physicalVariantIds = Array.from(
    new Set(
      products.flatMap((product) =>
        product.product_variants.map((variant) => getPhysicalInventoryVariantId(variant)),
      ),
    ),
  );
  const { data: physicalInventory } = physicalVariantIds.length
    ? await supabase
        .from("inventory")
        .select("variant_id, stock_on_hand, low_stock_threshold")
        .in("variant_id", physicalVariantIds)
    : { data: [] };
  const stockByVariant = new Map(
    ((physicalInventory || []) as { variant_id: string; stock_on_hand: number }[]).map(
      (row) => [row.variant_id, row.stock_on_hand],
    ),
  );
  const thresholdByVariant = new Map(
    ((physicalInventory || []) as { variant_id: string; low_stock_threshold: number }[]).map(
      (row) => [row.variant_id, row.low_stock_threshold],
    ),
  );

  return {
    products: products.map((product) => ({
      ...product,
      product_variants: product.product_variants.map((variant) => {
        const unitsPerPack = getVariantUnitsPerPack(variant);
        const physicalStock = stockByVariant.get(getPhysicalInventoryVariantId(variant)) || 0;

        return {
          ...variant,
          inventory: [
            {
              stock_on_hand: physicalStock,
              low_stock_threshold:
                thresholdByVariant.get(getPhysicalInventoryVariantId(variant)) ??
                getVariantInventory(variant)?.low_stock_threshold ??
                0,
            },
          ],
          units_per_pack: unitsPerPack,
          physical_stock_on_hand: physicalStock,
          available_packs: getAvailablePacks(physicalStock, unitsPerPack),
          effective_price_cents: getEffectivePriceCents(variant),
          price_per_unit_cents: getPricePerUnitCents(
            getEffectivePriceCents(variant),
            unitsPerPack,
          ),
          discount_cents: getDiscountCents(variant),
        };
      }),
    })),
  };
}

export async function getAdminInventory() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { inventory: null, movements: [], error: "Supabase env is not configured." };
  }

  const [productsResult, settings, movementsResult] = await Promise.all([
    getAdminProducts(),
    getAppSettings(),
    supabase
      .from("inventory_movements")
      .select("id, movement_type, quantity_delta, reason, metadata, created_at, created_by, product_variants(sku, name)")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const inventoryItems = productsResult.products.flatMap((product) =>
    product.product_variants.map((variant) => {
      const inventory = getVariantInventory(variant);
      const stockOnHand = Number(inventory?.stock_on_hand || 0);
      const lowStockThreshold = Number(inventory?.low_stock_threshold ?? settings.low_stock_threshold);
      const stockStatus = getInventoryStatus({
        stock: stockOnHand,
        lowStockThreshold,
      });

      return {
        product_id: product.id,
        product_name: product.name,
        product_status: product.status,
        is_visible: product.is_visible,
        variant_id: variant.id,
        sku: variant.sku,
        variant_name: variant.name,
        variant_status: variant.status,
        price_cents: variant.price_cents,
        stock_on_hand: stockOnHand,
        low_stock_threshold: lowStockThreshold,
        stock_status: stockStatus,
        stock_status_label:
          stockStatus === "out_of_stock"
            ? "Agotado"
            : stockStatus === "low_stock"
              ? "Stock bajo"
              : "Disponible",
      };
    }),
  );

  return {
    inventory: {
      stock_on_hand: inventoryItems.reduce((sum, item) => sum + item.stock_on_hand, 0),
      low_stock_threshold: settings.low_stock_threshold,
      critical_stock_threshold: settings.critical_stock_threshold,
      stock_status:
        inventoryItems.length === 0
          ? "out_of_stock"
          : inventoryItems.some((item) => item.stock_on_hand <= 0)
            ? "critical"
            : inventoryItems.some((item) => item.stock_status === "low_stock")
              ? "low"
              : "healthy",
      items: inventoryItems,
    },
    movements: movementsResult.data || [],
    error: productsResult.error || movementsResult.error?.message,
  };
}

export async function getAdminOrders({
  filter = "all",
  q = "",
}: {
  filter?: string;
  q?: string;
} = {}): Promise<{
  orders: AdminOrderRow[];
  error?: string;
}> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { orders: [], error: "Supabase env is not configured." };
  }

  const safeFilter = ADMIN_ORDER_FILTERS.includes(filter as AdminOrderFilter)
    ? (filter as AdminOrderFilter)
    : "all";
  const search = q.trim().toLowerCase();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_id, order_number, total_cents, currency, payment_provider, payment_status, fulfillment_status, status, created_at, paid_at, customers(email, phone, first_name, last_name), order_items(name, quantity, units_per_pack, physical_units), email_events(status, created_at), shipments(tracking_number)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { orders: [], error: error.message };
  }

  const orders = (data || [])
    .filter((order) => matchesOrderFilter(order, safeFilter))
    .map((order) => {
      const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const emailEvents = Array.isArray(order.email_events) ? order.email_events : [];
      const latestEmail = emailEvents.sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )[0];
      const shipments = Array.isArray(order.shipments) ? order.shipments : [];
      const trackingNumber = shipments[0]?.tracking_number || "";
      const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");

      return {
        id: order.id,
        customer_id: order.customer_id,
        order_number: order.order_number,
        total_cents: order.total_cents,
        currency: order.currency,
        payment_provider: order.payment_provider,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        status: order.status,
        created_at: order.created_at,
        paid_at: order.paid_at,
        customer_email: customer?.email || "Sin cliente",
        customer_name: customerName || "Sin nombre",
        pack_label: items.map((item) => item.name).join(", ") || "-",
        packs: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        physical_units: items.reduce(
          (sum, item) => sum + Number(item.physical_units || item.quantity || 0),
          0,
        ),
        email_status: latestEmail?.status || "none",
        tracking_number: trackingNumber,
      };
    })
    .filter((order) => {
      if (!search) {
        return true;
      }

      return [
        order.order_number,
        order.customer_email,
        order.customer_name,
        order.tracking_number,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });

  return { orders };
}

export async function getAdminShipping({
  view,
  filter,
  q = "",
  product = "all",
  email = "all",
  carrier = "all",
  page = "1",
  pageSize = "25",
}: {
  view?: string;
  filter?: string;
  q?: string;
  product?: string;
  email?: string;
  carrier?: string;
  page?: string;
  pageSize?: string;
} = {}) {
  const supabase = createSupabaseAdminClient();
  const selectedView = parseShippingView(view || mapLegacyShippingFilter(filter));
  const selectedPage = Math.max(1, Number.parseInt(String(page), 10) || 1);
  const selectedPageSize = [25, 50].includes(Number.parseInt(String(pageSize), 10))
    ? Number.parseInt(String(pageSize), 10)
    : 25;
  const search = q.trim().toLowerCase();

  if (!supabase) {
    const emptyCounts = getShippingActionCounts([], {
      prepareAttentionHours: 24,
      shippingAttentionHours: 48,
    });

    return {
      rows: [],
      allRows: [],
      counts: emptyCounts,
      view: selectedView,
      filters: { q, product, email, carrier, page: selectedPage, pageSize: selectedPageSize },
      pagination: { page: selectedPage, pageSize: selectedPageSize, total: 0, totalPages: 1 },
      settings: {
        carrierDisplayName: "DHL Express",
        estimatedDelivery: "2–5 días hábiles",
        prepareAttentionHours: 24,
        shippingAttentionHours: 48,
      },
      error: "Supabase env is not configured.",
    };
  }

  const settings = await getAppSettings();
  const sla = {
    prepareAttentionHours: settings.prepare_attention_hours,
    shippingAttentionHours: settings.shipping_attention_hours,
  };
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_id, order_number, total_cents, currency, payment_status, fulfillment_status, status, created_at, paid_at, shipped_at, customers(id, email, phone, first_name, last_name), customer_addresses(full_name, phone, line1, line2, neighborhood, city, state, postal_code, country), order_items(name, sku, quantity, units_per_pack, physical_units, subtotal_cents), shipments(id, carrier, status, tracking_number, tracking_url, shipped_at, delivered_at), email_events(id, template_key, event_type, status, created_at, updated_at, sent_at)",
    )
    .in("fulfillment_status", ["unfulfilled", "preparing", "ready_to_ship", "shipped", "delivered", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    const emptyCounts = getShippingActionCounts([], sla);

    return {
      rows: [],
      allRows: [],
      counts: emptyCounts,
      view: selectedView,
      filters: { q, product, email, carrier, page: selectedPage, pageSize: selectedPageSize },
      pagination: { page: selectedPage, pageSize: selectedPageSize, total: 0, totalPages: 1 },
      settings: {
        carrierDisplayName: settings.carrier_display_name,
        estimatedDelivery: getEstimatedDeliveryCopy({
          minDays: settings.shipping_min_days,
          maxDays: settings.shipping_max_days,
          businessDays: settings.shipping_business_days,
        }),
        prepareAttentionHours: settings.prepare_attention_hours,
        shippingAttentionHours: settings.shipping_attention_hours,
      },
      error: error.message,
    };
  }

  const orderIds = (data || []).map((order) => order.id);
  const auditResult = orderIds.length
    ? await supabase
        .from("audit_log")
        .select("id, row_id, action, created_at, after_data")
        .eq("table_name", "orders")
        .in("row_id", orderIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  const auditByOrder = new Map<string, Array<{ action: string; created_at: string; after_data?: unknown }>>();

  for (const audit of auditResult.data || []) {
    const rowId = String(audit.row_id || "");
    const events = auditByOrder.get(rowId) || [];

    events.push({
      action: audit.action,
      created_at: audit.created_at,
      after_data: audit.after_data,
    });
    auditByOrder.set(rowId, events);
  }

  const allRows = (data || []).map((order) => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const address = Array.isArray(order.customer_addresses)
      ? order.customer_addresses[0]
      : order.customer_addresses;
    const shipments = Array.isArray(order.shipments) ? order.shipments : [];
    const shipment = shipments[0] || null;
    const emailEvents = Array.isArray(order.email_events) ? order.email_events : [];
    const shippingEmail = [...emailEvents]
      .filter((event) => {
        const type = event.event_type || event.template_key;

        return type === "SHIPPING_CONFIRMATION" || type === "order_shipped";
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const packs = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const physicalUnits = items.reduce(
      (sum, item) =>
        sum +
        Number(
          item.physical_units ||
            Number(item.quantity || 0) * Number(item.units_per_pack || 1),
        ),
      0,
    );
    const productLabel = formatShippingProductLabel(items);
    const audits = auditByOrder.get(order.id) || [];
    const stateStartedAt = getStateStartedAtFromAudit(order.fulfillment_status, audits) ||
      shipment?.shipped_at ||
      shipment?.delivered_at ||
      order.shipped_at ||
      order.paid_at ||
      order.created_at;
    const baseRow = {
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      status: order.status,
      paid_at: order.paid_at,
      created_at: order.created_at,
      state_started_at: stateStartedAt,
      shipped_at: shipment?.shipped_at || order.shipped_at || null,
      delivered_at: shipment?.delivered_at || null,
      tracking_number: shipment?.tracking_number || "",
      shipment_status: shipment?.status || "",
      email_status: shippingEmail?.status || "none",
    };
    const problems = getShippingProblems(baseRow, sla);

    return {
      id: order.id,
      customer_id: order.customer_id,
      order_number: order.order_number,
      customer_name: getOrderCustomerName(customer),
      customer_email: customer?.email || "Sin cliente",
      customer_phone: customer?.phone || address?.phone || "",
      customer_city: address?.city || "",
      customer_state: address?.state || "",
      address_lines: formatAddressLines(address),
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      status: order.status,
      created_at: order.created_at,
      paid_at: order.paid_at,
      state_started_at: getShippingStateStartedAt(baseRow),
      time_in_state: formatTimeInState(getShippingStateStartedAt(baseRow)),
      problem_labels: problems.map((problem) => problem.label),
      problem_actions: problems.map((problem) => problem.action),
      product_label: productLabel,
      product_subline:
        packs > 1
          ? `${packs} packs · ${physicalUnits} Luzelas físicas`
          : `${physicalUnits} ${physicalUnits === 1 ? "unidad" : "unidades"}`,
      product_filter: productLabel.split(" - ")[0] || productLabel,
      packs,
      physical_units: physicalUnits,
      total_cents: Number(order.total_cents || 0),
      currency: order.currency,
      carrier: shipment?.carrier || settings.carrier_display_name,
      shipment_status: shipment?.status || "none",
      tracking_number: shipment?.tracking_number || "",
      tracking_url: shipment?.tracking_url || "",
      shipped_at: shipment?.shipped_at || order.shipped_at || null,
      delivered_at: shipment?.delivered_at || null,
      email_status: shippingEmail?.status || "none",
      email_event_id: shippingEmail?.id || null,
      email_updated_at:
        shippingEmail?.sent_at || shippingEmail?.updated_at || shippingEmail?.created_at || null,
      estimated_delivery: getEstimatedDeliveryCopy({
        minDays: settings.shipping_min_days,
        maxDays: settings.shipping_max_days,
        businessDays: settings.shipping_business_days,
      }),
      timeline: buildShippingTimeline({
        order,
        shipment,
        shippingEmail,
        audits,
      }),
    } satisfies AdminShippingRow;
  });
  const counts = getShippingActionCounts(allRows, sla);
  const filteredRows = sortShippingQueue(
    allRows
      .filter((row) => matchesShippingView(row, selectedView, sla))
      .filter((row) => {
        if (!search) {
          return true;
        }

        return [
          row.order_number,
          row.customer_name,
          row.customer_email,
          row.tracking_number,
          row.product_label,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .filter((row) => product === "all" || row.product_filter === product)
      .filter((row) => email === "all" || row.email_status === email)
      .filter((row) => carrier === "all" || row.carrier === carrier),
    sla,
  );
  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / selectedPageSize));
  const safePage = Math.min(selectedPage, totalPages);
  const start = (safePage - 1) * selectedPageSize;

  return {
    rows: filteredRows.slice(start, start + selectedPageSize),
    allRows,
    counts,
    view: selectedView,
    filters: { q, product, email, carrier, page: safePage, pageSize: selectedPageSize },
    pagination: { page: safePage, pageSize: selectedPageSize, total, totalPages },
    settings: {
      carrierDisplayName: settings.carrier_display_name,
      estimatedDelivery: getEstimatedDeliveryCopy({
        minDays: settings.shipping_min_days,
        maxDays: settings.shipping_max_days,
        businessDays: settings.shipping_business_days,
      }),
      prepareAttentionHours: settings.prepare_attention_hours,
      shippingAttentionHours: settings.shipping_attention_hours,
    },
    error: auditResult.error?.message,
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { order: null, movements: [], error: "Supabase env is not configured." };
  }

  const [orderResult, movementsResult, eventsResult, emailEventsResult, auditResult, attributionResult] =
    await Promise.all([
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
        .select("id, template_key, event_type, recipient, status, provider, provider_message_id, attempt_count, last_attempt_at, error_code, error_message, sent_at, created_at, updated_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("id, action, created_at, after_data")
        .eq("table_name", "orders")
        .eq("row_id", orderId)
        .order("created_at", { ascending: false }),
      supabase.from("order_attribution").select("*").eq("order_id", orderId).maybeSingle(),
    ]);

  if (orderResult.error) {
    return { order: null, movements: [], error: orderResult.error.message };
  }

  return {
    order: orderResult.data,
    movements: movementsResult.data || [],
    events: eventsResult.data || [],
    emailEvents: emailEventsResult.data || [],
    auditEvents: auditResult.data || [],
    attribution:
      attributionResult.error || !attributionResult.data
        ? getAttributionOrderSnapshotFromMetadata(orderResult.data?.metadata) ||
          (orderResult.data ? getFallbackOrderAttribution(orderResult.data) : null)
        : (attributionResult.data as OrderAttributionRow),
    error:
      movementsResult.error?.message ||
      eventsResult.error?.message ||
      emailEventsResult.error?.message ||
      auditResult.error?.message,
  };
}

export async function getAdminCustomers() {
  return getAdminCustomersWithFilters();
}

export async function getAdminCustomersWithFilters({
  q = "",
  segment = "all",
  sort = "last_order",
  recent = "",
}: AdminCustomerFilters = {}): Promise<{
  customers: AdminCustomerRow[];
  error?: string;
  filters: {
    q: string;
    segment: CustomerSegmentFilter;
    sort: CustomerSort;
    recent: boolean;
  };
}> {
  const supabase = createSupabaseAdminClient();
  const safeSegment = parseCustomerSegment(segment);
  const safeSort = parseCustomerSort(sort);
  const search = q.trim().toLowerCase();
  const recentOnly = recent === "30d";

  if (!supabase) {
    return {
      customers: [],
      error: "Supabase env is not configured.",
      filters: { q, segment: safeSegment, sort: safeSort, recent: recentOnly },
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, email, phone, first_name, last_name, lifetime_value_cents, last_order_at, created_at, customer_addresses(line1, city, state, postal_code, created_at), customer_notes(note, created_at), orders(id, order_number, total_cents, payment_status, status, cancelled_at, refunded_at, created_at, paid_at)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return {
      customers: [],
      error: error.message,
      filters: { q, segment: safeSegment, sort: safeSort, recent: recentOnly },
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const customers = (data || [])
    .map((customer) => {
      const orders = Array.isArray(customer.orders) ? customer.orders : [];
      const paidOrders = orders.filter(isValidPaidOrder);
      const computedSpend = paidOrders.reduce(
        (sum, order) => sum + Number(order.total_cents || 0),
        0,
      );
      const paidOrdersSorted = [...paidOrders].sort((a, b) =>
        String(b.paid_at || b.created_at).localeCompare(String(a.paid_at || a.created_at)),
      )[0];
      const firstPaidOrder = [...paidOrders].sort((a, b) =>
        String(a.paid_at || a.created_at).localeCompare(String(b.paid_at || b.created_at)),
      )[0];
      const addresses = Array.isArray(customer.customer_addresses)
        ? customer.customer_addresses
        : [];
      const latestAddress = [...addresses].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )[0];
      const notes = Array.isArray(customer.customer_notes) ? customer.customer_notes : [];
      const latestNote = [...notes].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      )[0];
      const name = getOrderCustomerName(customer);
      const paidOrdersCount = paidOrders.length;
      const lifetimeSpendCents = computedSpend;
      const lastOrderAt = paidOrdersSorted?.paid_at || paidOrdersSorted?.created_at || null;

      return {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        first_name: customer.first_name,
        last_name: customer.last_name,
        name,
        city: latestAddress?.city || "",
        state: latestAddress?.state || "",
        paid_orders_count: paidOrdersCount,
        lifetime_spend_cents: lifetimeSpendCents,
        average_order_value_cents: getAverageOrderValueCents(
          lifetimeSpendCents,
          paidOrdersCount,
        ),
        first_order_at: firstPaidOrder?.paid_at || firstPaidOrder?.created_at || null,
        last_order_at: lastOrderAt,
        segment: getCustomerSegment({
          paidOrders: paidOrdersCount,
          lifetimeSpendCents,
        }),
        latest_note: latestNote?.note || null,
      };
    })
    .filter((customer) => {
      if (safeSegment !== "all" && customer.segment !== safeSegment) {
        return false;
      }

      if (recentOnly) {
        if (!customer.last_order_at || new Date(customer.last_order_at) < thirtyDaysAgo) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      return [customer.name, customer.email, customer.phone, customer.city, customer.state]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => {
      if (safeSort === "lifetime_spend") {
        return b.lifetime_spend_cents - a.lifetime_spend_cents;
      }

      if (safeSort === "orders") {
        return b.paid_orders_count - a.paid_orders_count;
      }

      if (safeSort === "name") {
        return a.name.localeCompare(b.name, "es-MX");
      }

      return String(b.last_order_at || "").localeCompare(String(a.last_order_at || ""));
    });

  return {
    customers,
    filters: { q, segment: safeSegment, sort: safeSort, recent: recentOnly },
  };
}

export async function getAdminShell() {
  const [dashboard, shipping] = await Promise.all([
    getAdminDashboard(),
    getAdminShipping({ view: "attention" }),
  ]);
  const notificationItems: AdminNotificationItem[] = [
    {
      id: "orders-to-prepare",
      label: "Órdenes por preparar",
      count: shipping.counts.toPrepare,
      href: "/admin/shipping?view=to_prepare",
      tone: "orders",
    },
    {
      id: "shipping-needs-guide",
      label: "Envíos preparando sin guía",
      count: shipping.counts.needsGuide,
      href: "/admin/shipping?view=preparing",
      tone: "shipping",
    },
    {
      id: "failed-emails",
      label: "Problemas de envío/email",
      count: shipping.counts.problems,
      href: "/admin/shipping?view=problems",
      tone: "email",
    },
    {
      id: "low-stock",
      label: "Inventario bajo",
      count: dashboard.pending?.lowStock ?? 0,
      href: "/admin/inventory",
      tone: "inventory",
    },
  ];

  return {
    pendingOrders: shipping.counts.toPrepare + shipping.counts.needsGuide,
    notificationCount: notificationItems.reduce((sum, item) => sum + item.count, 0),
    notificationItems,
    searchItems: dashboard.searchItems,
    error: dashboard.error,
  };
}

export async function getAdminCustomerDetail(customerId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { customer: null, error: "Supabase env is not configured." };
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, email, phone, first_name, last_name, lifetime_value_cents, last_order_at, units_purchased, created_at, customer_addresses(id, full_name, phone, line1, line2, neighborhood, city, state, postal_code, country, is_default_shipping, created_at), customer_notes(id, note, author_id, created_at), orders(id, order_number, total_cents, currency, payment_status, fulfillment_status, status, cancelled_at, refunded_at, created_at, paid_at, metadata, order_items(name, sku, quantity, units_per_pack, physical_units, subtotal_cents))",
    )
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { customer: null, error: error.message };
  }

  if (!data) {
    return { customer: null };
  }

  const orders = Array.isArray(data.orders) ? data.orders : [];
  const paidOrders = orders.filter(isValidPaidOrder);
  const computedSpend = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const sortedPaidOrders = [...paidOrders].sort((a, b) =>
    String(b.paid_at || b.created_at).localeCompare(String(a.paid_at || a.created_at)),
  )[0];
  const firstPaidOrder = [...paidOrders].sort((a, b) =>
    String(a.paid_at || a.created_at).localeCompare(String(b.paid_at || b.created_at)),
  )[0];
  const acquisition = firstPaidOrder
    ? getAttributionOrderSnapshotFromMetadata(firstPaidOrder.metadata) ||
      getFallbackOrderAttribution(firstPaidOrder)
    : null;
  const paidOrdersCount = paidOrders.length;
  const lifetimeSpendCents = computedSpend;

  return {
    customer: {
      ...data,
      orders_count: paidOrdersCount,
      paid_orders_count: paidOrdersCount,
      lifetime_spend_cents: lifetimeSpendCents,
      average_order_value_cents: getAverageOrderValueCents(lifetimeSpendCents, paidOrdersCount),
      first_order: firstPaidOrder || null,
      acquisition,
      last_order: sortedPaidOrders || null,
      segment: getCustomerSegment({
        paidOrders: paidOrdersCount,
        lifetimeSpendCents,
      }),
      orders: orders.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    },
  };
}

export async function getAdminAnalytics({
  range: rangeInput = "30d",
  startDate,
  endDate,
  touch: touchInput = "last",
  source: sourceFilter = "all",
  campaign: campaignFilter = "all",
  product: productFilter = "all",
}: {
  range?: string;
  startDate?: string;
  endDate?: string;
  touch?: string;
  source?: string;
  campaign?: string;
  product?: string;
} = {}): Promise<{ analytics: AdminAnalyticsData | null; error?: string }> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { analytics: null, error: "Supabase env is not configured." };
  }

  const settings = await getAppSettings();
  const range = parseAnalyticsRange(rangeInput);
  const touch = parseAttributionTouch(touchInput);
  const { start, end, previousStart } = getAnalyticsWindow({
    range,
    startDate,
    endDate,
    timeZone: settings.timezone,
  });

  const [
    ordersResult,
    previousOrdersResult,
    itemsResult,
    previousItemsResult,
    productsResult,
    inventoryResult,
    emailResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, customer_id, order_number, total_cents, currency, payment_status, fulfillment_status, status, paid_at, created_at, cancelled_at, refunded_at, shipped_at, metadata, customer_addresses(city, state), customers(id, email, first_name, last_name), shipments(shipped_at)",
      )
      .gte("paid_at", start.toISOString())
      .lt("paid_at", end.toISOString())
      .order("paid_at", { ascending: false }),
    supabase
      .from("orders")
      .select(
        "id, customer_id, total_cents, payment_status, fulfillment_status, status, paid_at, created_at, cancelled_at, refunded_at",
      )
      .gte("paid_at", previousStart.toISOString())
      .lt("paid_at", start.toISOString()),
    supabase
      .from("order_items")
      .select(
        "id, order_id, sku, name, quantity, units_per_pack, physical_units, unit_price_cents, subtotal_cents, orders(id, customer_id, total_cents, payment_status, status, paid_at, created_at, cancelled_at, refunded_at)",
      ),
    supabase
      .from("order_items")
      .select(
        "id, physical_units, orders(id, payment_status, status, paid_at, created_at, cancelled_at, refunded_at)",
      ),
    supabase
      .from("products")
      .select(
        "name, product_variants(sku, name, price_cents, compare_at_price_cents, offer_price_cents, offer_active)",
      )
      .is("deleted_at", null),
    supabase.from("inventory").select("stock_on_hand"),
    supabase
      .from("email_events")
      .select("template_key, event_type, status, created_at")
      .gte("created_at", start.toISOString()),
  ]);

  if (ordersResult.error) {
    return { analytics: null, error: ordersResult.error.message };
  }

  const orders = (ordersResult.data || []).filter(isValidPaidOrder);
  const orderIds = orders.map((order) => order.id);
  const attributionResult = orderIds.length
    ? await supabase.from("order_attribution").select("*").in("order_id", orderIds)
    : { data: [], error: null };
  const attributionByOrder = new Map<string, OrderAttributionRow>();

  if (!attributionResult.error) {
    for (const row of attributionResult.data || []) {
      attributionByOrder.set(row.order_id, row as OrderAttributionRow);
    }
  }

  const previousOrders = (previousOrdersResult.data || []).filter(isValidPaidOrder);
  const allCustomerIds = new Set<string>();
  const periodCustomerIds = new Set<string>();
  const returningPeriodCustomerIds = new Set<string>();

  (previousOrdersResult.data || [])
    .filter(isValidPaidOrder)
    .forEach((order) => {
      if (order.customer_id) {
        allCustomerIds.add(order.customer_id);
      }
    });

  orders.forEach((order) => {
    if (order.customer_id) {
      periodCustomerIds.add(order.customer_id);

      if (allCustomerIds.has(order.customer_id)) {
        returningPeriodCustomerIds.add(order.customer_id);
      }

      allCustomerIds.add(order.customer_id);
    }
  });

  const revenueCents = orders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
  const previousRevenueCents = previousOrders.reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const paidItems = (itemsResult.data || []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;

    return order && isValidPaidOrder(order) && isOrderInRange(order, start, end);
  });
  const previousItems = (previousItemsResult.data || []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;

    return order && isValidPaidOrder(order) && isOrderInRange(order, previousStart, start);
  });
  const unitsSold = paidItems.reduce(
    (sum, item) => sum + Number(item.physical_units || item.quantity || 0),
    0,
  );
  const previousUnitsSold = previousItems.reduce(
    (sum, item) => sum + Number(item.physical_units || 0),
    0,
  );
  const salesByDayMap = new Map<string, { revenue_cents: number; orders: Set<string> }>();

  orders.forEach((order) => {
    const day = formatMexicoDayKey(order.paid_at || order.created_at, settings.timezone);
    const current = salesByDayMap.get(day) || { revenue_cents: 0, orders: new Set<string>() };
    current.revenue_cents += Number(order.total_cents || 0);
    current.orders.add(order.id);
    salesByDayMap.set(day, current);
  });

  const productMap = new Map<
    string,
    {
      name: string;
      sku: string;
      revenue_cents: number;
      orders: Set<string>;
      packs_sold: number;
      physical_units: number;
    }
  >();

  paidItems.forEach((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    const key = item.sku || item.name;
    const current =
      productMap.get(key) ||
      {
        name: item.name,
        sku: item.sku,
        revenue_cents: 0,
        orders: new Set<string>(),
        packs_sold: 0,
        physical_units: 0,
      };
    current.revenue_cents += Number(item.subtotal_cents || 0);
    current.packs_sold += Number(item.quantity || 0);
    current.physical_units += Number(item.physical_units || item.quantity || 0);

    if (order?.id) {
      current.orders.add(order.id);
    }

    productMap.set(key, current);
  });

  const productRevenue = Array.from(productMap.values()).reduce(
    (sum, item) => sum + item.revenue_cents,
    0,
  );
  const salesByProduct = Array.from(productMap.values())
    .map((item) => ({
      name: item.name,
      sku: item.sku,
      revenue_cents: item.revenue_cents,
      orders: item.orders.size,
      packs_sold: item.packs_sold,
      physical_units: item.physical_units,
      revenue_percentage: productRevenue
        ? Math.round((item.revenue_cents / productRevenue) * 100)
        : 0,
    }))
    .sort((a, b) => b.revenue_cents - a.revenue_cents);

  const salesBySku = new Map(salesByProduct.map((item) => [item.sku, item]));
  const offerPerformance = ((productsResult.data || []) as ProductRow[])
    .flatMap((product) =>
      (product.product_variants || []).map((variant) => {
        const sales = salesBySku.get(variant.sku);

        return {
          product: variant.name || product.name,
          original_price_cents: Number(variant.compare_at_price_cents || variant.price_cents || 0),
          effective_price_cents: getEffectivePriceCents(variant),
          orders_sold: sales?.orders || 0,
          revenue_cents: sales?.revenue_cents || 0,
        };
      }),
    )
    .filter((item) => item.orders_sold > 0 || item.effective_price_cents < item.original_price_cents)
    .sort((a, b) => b.revenue_cents - a.revenue_cents);

  const customerMap = new Map<
    string,
    { id: string; name: string; orders: Set<string>; lifetime_spend_cents: number; last_order_at: string | null }
  >();

  orders.forEach((order) => {
    if (!order.customer_id) {
      return;
    }

    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const current =
      customerMap.get(order.customer_id) ||
      {
        id: order.customer_id,
        name: getOrderCustomerName(customer),
        orders: new Set<string>(),
        lifetime_spend_cents: 0,
        last_order_at: null,
      };
    current.orders.add(order.id);
    current.lifetime_spend_cents += Number(order.total_cents || 0);
    const orderDate = order.paid_at || order.created_at;

    if (!current.last_order_at || String(orderDate).localeCompare(current.last_order_at) > 0) {
      current.last_order_at = orderDate;
    }

    customerMap.set(order.customer_id, current);
  });

  const geographyMap = new Map<string, { state: string; city: string; orders: number; revenue_cents: number }>();

  orders.forEach((order) => {
    const address = Array.isArray(order.customer_addresses)
      ? order.customer_addresses[0]
      : order.customer_addresses;
    const state = address?.state || "Sin estado";
    const city = address?.city || "Sin ciudad";
    const key = `${state}::${city}`;
    const current = geographyMap.get(key) || { state, city, orders: 0, revenue_cents: 0 };
    current.orders += 1;
    current.revenue_cents += Number(order.total_cents || 0);
    geographyMap.set(key, current);
  });

  const fulfillment = {
    pending: orders.filter((order) => order.fulfillment_status === "unfulfilled").length,
    preparing: orders.filter((order) => order.fulfillment_status === "preparing").length,
    shipped: orders.filter((order) => order.fulfillment_status === "shipped").length,
    delivered: orders.filter((order) => order.fulfillment_status === "delivered").length,
    paid_to_shipped_average_hours: getAveragePaidToShippedHours(orders),
  };
  const emailRows = emailResult.data || [];
  const inventoryStock = (inventoryResult.data || []).reduce(
    (sum, item) => sum + Number(item.stock_on_hand || 0),
    0,
  );
  const daysInRange = range === "today" ? 1 : range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const dailyUnits = daysInRange >= 7 ? unitsSold / daysInRange : 0;
  const attribution = buildAttributionAnalytics({
    attributionByOrder,
    currency: settings.currency_code.toLowerCase(),
    filters: {
      campaign: campaignFilter,
      product: productFilter,
      source: sourceFilter,
    },
    orders,
    paidItems,
    touch,
  });

  return {
    analytics: {
      range,
      start: start.toISOString(),
      end: end.toISOString(),
      previousStart: previousStart.toISOString(),
      currency: settings.currency_code.toLowerCase(),
      timezone: settings.timezone,
      summary: {
        revenue_cents: revenueCents,
        previous_revenue_cents: previousRevenueCents,
        orders: orders.length,
        previous_orders: previousOrders.length,
        units_sold: unitsSold,
        previous_units_sold: previousUnitsSold,
        average_order_value_cents: getAverageOrderValueCents(revenueCents, orders.length),
        new_customers: periodCustomerIds.size - returningPeriodCustomerIds.size,
        returning_customers: returningPeriodCustomerIds.size,
        repeat_purchase_rate: allCustomerIds.size
          ? Math.round((returningPeriodCustomerIds.size / allCustomerIds.size) * 100)
          : 0,
      },
      salesByDay: Array.from(salesByDayMap.entries())
        .map(([day, item]) => ({
          day,
          revenue_cents: item.revenue_cents,
          orders: item.orders.size,
        }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      salesByProduct,
      offerPerformance,
      topCustomers: Array.from(customerMap.values())
        .map((customer) => ({
          id: customer.id,
          name: customer.name,
          orders: customer.orders.size,
          lifetime_spend_cents: customer.lifetime_spend_cents,
          last_order_at: customer.last_order_at,
        }))
        .sort((a, b) => b.lifetime_spend_cents - a.lifetime_spend_cents)
        .slice(0, 6),
      geography: Array.from(geographyMap.values())
        .sort((a, b) => b.revenue_cents - a.revenue_cents)
        .slice(0, 6),
      fulfillment,
      email: {
        order_confirmation_sent: emailRows.filter(
          (event) =>
            (event.event_type === "ORDER_CONFIRMATION" || event.event_type === "payment_confirmed") &&
            event.status === "sent",
        ).length,
        shipping_confirmation_sent: emailRows.filter(
          (event) =>
            (event.event_type === "SHIPPING_CONFIRMATION" || event.event_type === "order_shipped") &&
            event.status === "sent",
        ).length,
        failed: emailRows.filter((event) => event.status === "failed").length,
        skipped: emailRows.filter((event) => event.status === "skipped").length,
      },
      inventory: {
        physical_stock: inventoryStock,
        units_sold_period: unitsSold,
        estimated_days_of_stock:
          dailyUnits > 0 ? Math.round((inventoryStock / dailyUnits) * 10) / 10 : null,
      },
      failures: {
        failed_payments: (ordersResult.data || []).filter((order) => order.payment_status === "failed")
          .length,
        cancelled_orders: (ordersResult.data || []).filter((order) => order.status === "cancelled")
          .length,
        refunds: (ordersResult.data || []).filter((order) => order.status === "refunded").length,
      },
      attribution,
    },
    error:
      previousOrdersResult.error?.message ||
      itemsResult.error?.message ||
      previousItemsResult.error?.message ||
      productsResult.error?.message ||
      inventoryResult.error?.message ||
      emailResult.error?.message,
  };
}

function buildAttributionAnalytics({
  attributionByOrder,
  filters,
  orders,
  paidItems,
  touch,
}: {
  attributionByOrder: Map<string, OrderAttributionRow>;
  currency: string;
  filters: {
    source: string;
    campaign: string;
    product: string;
  };
  orders: Array<{
    id: string;
    order_number?: string;
    total_cents: number | null;
    created_at: string;
    paid_at?: string | null;
    metadata?: unknown;
  }>;
  paidItems: Array<{
    order_id: string;
    name: string;
    physical_units?: number | null;
    quantity?: number | null;
    subtotal_cents?: number | null;
  }>;
  touch: "first" | "last";
}): AdminAnalyticsData["attribution"] {
  const orderSnapshots = new Map(
    orders.map((order) => [
      order.id,
      getAttributionForOrder(order, attributionByOrder.get(order.id)),
    ]),
  );
  const itemProductsByOrder = new Map<string, string[]>();
  const itemsByOrder = new Map<string, typeof paidItems>();

  for (const item of paidItems) {
    const items = itemsByOrder.get(item.order_id) || [];
    items.push(item);
    itemsByOrder.set(item.order_id, items);

    const products = itemProductsByOrder.get(item.order_id) || [];
    products.push(item.name || "Producto");
    itemProductsByOrder.set(item.order_id, products);
  }

  const filteredOrders = orders.filter((order) => {
    const attribution = orderSnapshots.get(order.id);
    const source = attribution ? getAttributionTouchValue(attribution, touch, "source") || "direct" : "direct";
    const campaign = attribution ? getAttributionTouchValue(attribution, touch, "campaign") || "unknown" : "unknown";
    const products = itemProductsByOrder.get(order.id) || [];

    return (
      (filters.source === "all" || source === filters.source) &&
      (filters.campaign === "all" || campaign === filters.campaign) &&
      (filters.product === "all" || products.includes(filters.product))
    );
  });
  const filteredOrderIds = new Set(filteredOrders.map((order) => order.id));
  const filteredItems = paidItems.filter((item) => filteredOrderIds.has(item.order_id));
  const revenueCents = filteredOrders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
  const sourceMap = new Map<
    string,
    { source: string; medium: string; orders: Set<string>; revenue_cents: number }
  >();
  const campaignMap = new Map<
    string,
    {
      campaign: string;
      source: string;
      orders: Set<string>;
      revenue_cents: number;
      productRevenue: Map<string, number>;
    }
  >();
  const contentMap = new Map<
    string,
    { content: string; campaign: string; orders: Set<string>; revenue_cents: number }
  >();
  const productCampaignMap = new Map<
    string,
    {
      campaign: string;
      product: string;
      orders: Set<string>;
      physical_units: number;
      revenue_cents: number;
    }
  >();

  for (const order of filteredOrders) {
    const attribution = orderSnapshots.get(order.id) || getFallbackOrderAttribution(order);
    const source = getAttributionTouchValue(attribution, touch, "source") || "direct";
    const medium = getAttributionTouchValue(attribution, touch, "medium") || "none";
    const campaign = getAttributionTouchValue(attribution, touch, "campaign") || "unknown";
    const content = getAttributionTouchValue(attribution, touch, "content") || "unknown";
    const orderRevenue = Number(order.total_cents || 0);
    const sourceKey = `${source}::${medium}`;
    const sourceRow =
      sourceMap.get(sourceKey) || { source, medium, orders: new Set<string>(), revenue_cents: 0 };

    sourceRow.orders.add(order.id);
    sourceRow.revenue_cents += orderRevenue;
    sourceMap.set(sourceKey, sourceRow);

    const campaignKey = `${source}::${campaign}`;
    const campaignRow =
      campaignMap.get(campaignKey) ||
      {
        campaign,
        source,
        orders: new Set<string>(),
        revenue_cents: 0,
        productRevenue: new Map<string, number>(),
      };

    campaignRow.orders.add(order.id);
    campaignRow.revenue_cents += orderRevenue;
    campaignMap.set(campaignKey, campaignRow);

    if (content !== "unknown") {
      const contentKey = `${campaign}::${content}`;
      const contentRow =
        contentMap.get(contentKey) || { content, campaign, orders: new Set<string>(), revenue_cents: 0 };

      contentRow.orders.add(order.id);
      contentRow.revenue_cents += orderRevenue;
      contentMap.set(contentKey, contentRow);
    }
  }

  for (const item of filteredItems) {
    const attribution = orderSnapshots.get(item.order_id);

    if (!attribution) {
      continue;
    }

    const campaign = getAttributionTouchValue(attribution, touch, "campaign") || "unknown";
    const product = item.name || "Producto";
    const key = `${campaign}::${product}`;
    const current =
      productCampaignMap.get(key) ||
      {
        campaign,
        product,
        orders: new Set<string>(),
        physical_units: 0,
        revenue_cents: 0,
      };

    current.orders.add(item.order_id);
    current.physical_units += Number(item.physical_units || item.quantity || 0);
    current.revenue_cents += Number(item.subtotal_cents || 0);
    productCampaignMap.set(key, current);

    const attributionSource = getAttributionTouchValue(attribution, touch, "source") || "direct";
    const campaignKey = `${attributionSource}::${campaign}`;
    const campaignRow = campaignMap.get(campaignKey);
    const currentProductRevenue = campaignRow?.productRevenue.get(product) || 0;

    campaignRow?.productRevenue.set(product, currentProductRevenue + Number(item.subtotal_cents || 0));
  }

  const metaRevenue = filteredOrders.reduce((sum, order) => {
    const attribution = orderSnapshots.get(order.id);
    const source = attribution ? getAttributionTouchValue(attribution, touch, "source") : "direct";
    const medium = attribution ? getAttributionTouchValue(attribution, touch, "medium") : "none";

    return source === "meta" || medium === "paid_social" ? sum + Number(order.total_cents || 0) : sum;
  }, 0);

  return {
    touch,
    revenue_cents: revenueCents,
    orders: filteredOrders.length,
    average_order_value_cents: getAverageOrderValueCents(revenueCents, filteredOrders.length),
    meta_revenue_percentage: revenueCents ? Math.round((metaRevenue / revenueCents) * 100) : 0,
    filters,
    sources: Array.from(sourceMap.values())
      .map((item) => ({
        source: item.source,
        medium: item.medium,
        orders: item.orders.size,
        revenue_cents: item.revenue_cents,
        average_order_value_cents: getAverageOrderValueCents(item.revenue_cents, item.orders.size),
        revenue_percentage: revenueCents ? Math.round((item.revenue_cents / revenueCents) * 100) : 0,
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents),
    campaigns: Array.from(campaignMap.values())
      .map((item) => ({
        campaign: item.campaign,
        source: item.source,
        orders: item.orders.size,
        revenue_cents: item.revenue_cents,
        average_order_value_cents: getAverageOrderValueCents(item.revenue_cents, item.orders.size),
        top_product: getTopMapKey(item.productRevenue),
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents),
    contents: Array.from(contentMap.values())
      .map((item) => ({
        content: item.content,
        campaign: item.campaign,
        orders: item.orders.size,
        revenue_cents: item.revenue_cents,
        average_order_value_cents: getAverageOrderValueCents(item.revenue_cents, item.orders.size),
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents),
    productsByCampaign: Array.from(productCampaignMap.values())
      .map((item) => ({
        campaign: item.campaign,
        product: item.product,
        orders: item.orders.size,
        physical_units: item.physical_units,
        revenue_cents: item.revenue_cents,
      }))
      .sort((a, b) => b.revenue_cents - a.revenue_cents),
  };
}

function getAttributionForOrder(
  order: { created_at: string; metadata?: unknown },
  row?: OrderAttributionRow,
) {
  return row || getAttributionOrderSnapshotFromMetadata(order.metadata) || getFallbackOrderAttribution(order);
}

function getFallbackOrderAttribution(order: { created_at: string }) {
  return {
    first_touch_source: "direct",
    first_touch_medium: "none",
    first_touch_campaign: "",
    first_touch_content: "",
    first_touch_term: "",
    first_touch_referrer: "",
    first_touch_landing_path: "/",
    first_touch_landing_url: "",
    first_seen_at: order.created_at,
    last_touch_source: "direct",
    last_touch_medium: "none",
    last_touch_campaign: "",
    last_touch_content: "",
    last_touch_term: "",
    last_touch_referrer: "",
    last_touch_landing_path: "/",
    last_touch_landing_url: "",
    last_seen_at: order.created_at,
  };
}

function getTopMapKey(map: Map<string, number>) {
  return (
    Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "Sin producto"
  );
}

export async function getCustomersCsv(filters: AdminCustomerFilters = {}) {
  const { customers, error } = await getAdminCustomersWithFilters(filters);

  if (error) {
    return { csv: "", error };
  }

  return {
    csv: rowsToCsv(
      customers.map((customer) => ({
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "",
        orders: customer.paid_orders_count,
        lifetime_spend: customer.lifetime_spend_cents / 100,
        average_order_value: customer.average_order_value_cents / 100,
        last_order: customer.last_order_at || "",
        status: customer.segment,
      })),
    ),
  };
}

export async function getOrdersCsv({
  filter = "all",
  q = "",
}: {
  filter?: string;
  q?: string;
} = {}) {
  const { orders, error } = await getAdminOrders({ filter, q });

  if (error) {
    return { csv: "", error };
  }

  return {
    csv: rowsToCsv(
      orders.map((order) => ({
        order_number: order.order_number,
        date: order.created_at,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        pack: order.pack_label,
        packs: order.packs,
        physical_units: order.physical_units,
        total: order.total_cents / 100,
        currency: order.currency,
        provider: order.payment_provider,
        payment_status: order.payment_status,
        fulfillment_status: order.fulfillment_status,
        email_status: order.email_status,
      })),
    ),
  };
}

export async function getAnalyticsCsv({
  range = "30d",
  startDate,
  endDate,
}: {
  range?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  const { analytics, error } = await getAdminAnalytics({ range, startDate, endDate });

  if (error || !analytics) {
    return { csv: "", error: error || "Analytics unavailable." };
  }

  return {
    csv: rowsToCsv(
      analytics.salesByDay.map((day) => ({
        day: day.day,
        revenue: day.revenue_cents / 100,
        orders: day.orders,
        range: analytics.range,
      })),
    ),
  };
}

export async function getAttributionCsv({
  range = "30d",
  startDate,
  endDate,
  touch: touchInput = "last",
  source = "all",
  campaign = "all",
  product = "all",
}: {
  range?: string;
  startDate?: string;
  endDate?: string;
  touch?: string;
  source?: string;
  campaign?: string;
  product?: string;
} = {}) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { csv: "", error: "Supabase env is not configured." };
  }

  const settings = await getAppSettings();
  const parsedRange = parseAnalyticsRange(range);
  const touch = parseAttributionTouch(touchInput);
  const { start, end } = getAnalyticsWindow({
    range: parsedRange,
    startDate,
    endDate,
    timeZone: settings.timezone,
  });
  const ordersResult = await supabase
    .from("orders")
    .select(
      "id, order_number, total_cents, currency, payment_status, status, paid_at, created_at, cancelled_at, refunded_at, metadata, order_items(name, physical_units, quantity, subtotal_cents)",
    )
    .gte("paid_at", start.toISOString())
    .lt("paid_at", end.toISOString())
    .order("paid_at", { ascending: false });

  if (ordersResult.error) {
    return { csv: "", error: ordersResult.error.message };
  }

  const orders = (ordersResult.data || []).filter(isValidPaidOrder);
  const attributionResult = orders.length
    ? await supabase.from("order_attribution").select("*").in("order_id", orders.map((order) => order.id))
    : { data: [], error: null };
  const attributionByOrder = new Map<string, OrderAttributionRow>();

  if (!attributionResult.error) {
    for (const row of attributionResult.data || []) {
      attributionByOrder.set(row.order_id, row as OrderAttributionRow);
    }
  }

  const rows = orders.flatMap((order) => {
    const attribution = getAttributionForOrder(order, attributionByOrder.get(order.id));
    const orderSource = getAttributionTouchValue(attribution, touch, "source") || "direct";
    const orderMedium = getAttributionTouchValue(attribution, touch, "medium") || "none";
    const orderCampaign = getAttributionTouchValue(attribution, touch, "campaign") || "unknown";
    const orderContent = getAttributionTouchValue(attribution, touch, "content") || "";
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    return items
      .filter((item) => product === "all" || item.name === product)
      .filter(() => source === "all" || orderSource === source)
      .filter(() => campaign === "all" || orderCampaign === campaign)
      .map((item) => ({
        date: order.paid_at || order.created_at,
        order_number: order.order_number,
        source: orderSource,
        medium: orderMedium,
        campaign: orderCampaign,
        content: orderContent,
        product: item.name,
        physical_units: Number(item.physical_units || item.quantity || 0),
        revenue: Number(item.subtotal_cents || order.total_cents || 0) / 100,
      }));
  });

  return { csv: rowsToCsv(rows) };
}

function getAnalyticsWindow({
  range,
  startDate,
  endDate,
  timeZone,
}: {
  range: AnalyticsRange;
  startDate?: string;
  endDate?: string;
  timeZone: string;
}) {
  if (range === "custom" && startDate && endDate) {
    const start = getMexicoStartOfDay(startDate, timeZone);
    const end = getMexicoEndOfDay(endDate, timeZone);

    if (
      Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      start.getTime() < end.getTime()
    ) {
      const duration = end.getTime() - start.getTime();

      return {
        start,
        end,
        previousStart: new Date(start.getTime() - duration),
      };
    }
  }

  const safeRange = range === "custom" ? "30d" : range;
  const start = getAnalyticsRangeStart(safeRange, new Date(), timeZone);

  return {
    start,
    end: new Date(),
    previousStart: getPreviousRangeStart(safeRange, start),
  };
}

function isOrderInRange(
  order: { paid_at?: string | null; created_at?: string | null },
  start: Date,
  end: Date,
) {
  const value = order.paid_at || order.created_at;

  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return time >= start.getTime() && time < end.getTime();
}

function getAveragePaidToShippedHours(
  orders: Array<{
    paid_at?: string | null;
    shipped_at?: string | null;
    shipments?: Array<{ shipped_at?: string | null }> | { shipped_at?: string | null } | null;
  }>,
) {
  const durations = orders
    .map((order) => {
      const shipment = Array.isArray(order.shipments) ? order.shipments[0] : order.shipments;
      const shippedAt = order.shipped_at || shipment?.shipped_at;

      if (!order.paid_at || !shippedAt) {
        return null;
      }

      return (new Date(shippedAt).getTime() - new Date(order.paid_at).getTime()) / 3_600_000;
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

  if (durations.length === 0) {
    return null;
  }

  return Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
}

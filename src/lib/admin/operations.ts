import { getAvailablePacks } from "../catalog/pack";
import type { AttributionOrderSnapshot } from "../attribution";

export const ADMIN_ORDER_FILTERS = [
  "all",
  "attention",
  "to_prepare",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type AdminOrderFilter = (typeof ADMIN_ORDER_FILTERS)[number];

export const ADMIN_SHIPPING_VIEWS = [
  "attention",
  "to_prepare",
  "preparing",
  "shipped",
  "delivered",
  "problems",
  "all",
] as const;

export type AdminShippingView = (typeof ADMIN_SHIPPING_VIEWS)[number];

export type ShippingSlaConfig = {
  prepareAttentionHours: number;
  shippingAttentionHours: number;
};

export type ShippingOperationRowInput = {
  payment_status: string;
  fulfillment_status: string;
  status: string;
  paid_at?: string | null;
  created_at: string;
  state_started_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  tracking_number?: string | null;
  shipment_status?: string | null;
  email_status?: string | null;
};

export type ShippingActionCounts = {
  attention: number;
  toPrepare: number;
  preparing: number;
  needsGuide: number;
  shipped: number;
  delivered: number;
  problems: number;
  all: number;
};

export const CUSTOMER_SEGMENTS = ["all", "new", "returning", "vip"] as const;

export type CustomerSegmentFilter = (typeof CUSTOMER_SEGMENTS)[number];

export type CustomerSegment = Exclude<CustomerSegmentFilter, "all">;

export const CUSTOMER_SORTS = ["last_order", "lifetime_spend", "orders", "name"] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const ANALYTICS_RANGES = ["today", "7d", "30d", "90d", "custom"] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const MANUAL_INVENTORY_MOVEMENTS = [
  "RECEIPT",
  "ADJUSTMENT",
  "DAMAGE",
  "SAMPLE",
  "RETURN",
  "OTHER",
] as const;

export type ManualInventoryMovement = (typeof MANUAL_INVENTORY_MOVEMENTS)[number];

export function parsePriceCents(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim().replace(",", ".");
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("price_must_be_positive");
  }

  const cents = Math.round(amount * 100);

  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("price_must_be_integer_cents");
  }

  return cents;
}

export function assertValidOfferPricing({
  originalPriceCents,
  offerPriceCents,
  offerActive,
}: {
  originalPriceCents: number;
  offerPriceCents: number | null;
  offerActive: boolean;
}) {
  if (!Number.isInteger(originalPriceCents) || originalPriceCents <= 0) {
    throw new Error("original_price_invalid");
  }

  if (!offerActive) {
    return;
  }

  if (!Number.isInteger(offerPriceCents) || Number(offerPriceCents) <= 0) {
    throw new Error("offer_price_invalid");
  }

  if (Number(offerPriceCents) >= originalPriceCents) {
    throw new Error("offer_price_must_be_lower_than_original");
  }
}

export function derivePackAvailability(physicalStock: number) {
  return {
    oneX: getAvailablePacks(physicalStock, 1),
    twoX: getAvailablePacks(physicalStock, 2),
    threeX: getAvailablePacks(physicalStock, 3),
  };
}

export function mapManualMovementType(type: string) {
  switch (type) {
    case "RECEIPT":
      return "purchase";
    case "ADJUSTMENT":
      return "adjustment";
    case "DAMAGE":
      return "damage";
    case "SAMPLE":
    case "OTHER":
      return "manual_correction";
    case "RETURN":
      return "return";
    default:
      throw new Error("unsupported_inventory_movement");
  }
}

export function normalizeInventoryDelta(type: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new Error("quantity_delta_required");
  }

  if (type === "DAMAGE" || type === "SAMPLE") {
    return -Math.abs(quantity);
  }

  return quantity;
}

export function assertInventoryWillNotGoNegative(stockOnHand: number, quantityDelta: number) {
  if (stockOnHand + quantityDelta < 0) {
    throw new Error("inventory_negative_not_allowed");
  }
}

export function canMarkPreparing(order: {
  payment_status: string;
  fulfillment_status: string;
  status: string;
}) {
  return (
    order.payment_status === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    order.fulfillment_status === "unfulfilled"
  );
}

export function canMarkDelivered(order: {
  payment_status: string;
  fulfillment_status: string;
  status: string;
}) {
  return (
    order.payment_status === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    order.fulfillment_status === "shipped"
  );
}

export function isOperationalPaidOrder(order: {
  payment_status: string;
  status: string;
  refunded_at?: string | null;
  cancelled_at?: string | null;
}) {
  return (
    order.payment_status === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    !order.cancelled_at &&
    !order.refunded_at
  );
}

export function isOrderToPrepare(order: {
  payment_status: string;
  fulfillment_status: string;
  status: string;
  refunded_at?: string | null;
  cancelled_at?: string | null;
}) {
  return isOperationalPaidOrder(order) && order.fulfillment_status === "unfulfilled";
}

export function isOrderPreparingWithoutGuide(order: {
  payment_status: string;
  fulfillment_status: string;
  status: string;
  tracking_number?: string | null;
  shipment?: { tracking_number?: string | null } | null;
  shipments?: Array<{ tracking_number?: string | null }> | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
}) {
  const trackingNumber =
    order.tracking_number ||
    order.shipment?.tracking_number ||
    order.shipments?.[0]?.tracking_number ||
    "";

  return (
    isOperationalPaidOrder(order) &&
    order.fulfillment_status === "preparing" &&
    !String(trackingNumber).trim()
  );
}

export function isOrderRequiringAttention(order: {
  payment_status: string;
  fulfillment_status: string;
  status: string;
  tracking_number?: string | null;
  shipment?: { tracking_number?: string | null } | null;
  shipments?: Array<{ tracking_number?: string | null }> | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
}) {
  return isOrderToPrepare(order) || isOrderPreparingWithoutGuide(order);
}

export function isValidShippingTrackingNumber(value?: string | null) {
  const normalized = String(value || "").trim().replace(/\s+/g, "").toUpperCase();

  return normalized.length >= 5 && normalized.length <= 80 && /^[A-Z0-9-]+$/.test(normalized);
}

export function normalizeShippingTrackingNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function getShippingStateStartedAt(order: ShippingOperationRowInput) {
  if (order.state_started_at) {
    return order.state_started_at;
  }

  if (order.fulfillment_status === "delivered") {
    return order.delivered_at || order.shipped_at || order.paid_at || order.created_at;
  }

  if (order.fulfillment_status === "shipped") {
    return order.shipped_at || order.paid_at || order.created_at;
  }

  if (order.fulfillment_status === "preparing") {
    return order.state_started_at || order.paid_at || order.created_at;
  }

  return order.paid_at || order.created_at;
}

export function getHoursSince(timestamp: string | null | undefined, now = new Date()) {
  if (!timestamp) {
    return 0;
  }

  const startedAt = new Date(timestamp).getTime();

  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  return Math.max(0, (now.getTime() - startedAt) / 3_600_000);
}

export function formatTimeInState(timestamp: string | null | undefined, now = new Date()) {
  const hours = getHoursSince(timestamp, now);

  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));

    return `Hace ${minutes} min`;
  }

  if (hours < 24) {
    const roundedHours = Math.round(hours);

    return `Hace ${roundedHours} h`;
  }

  const days = Math.round(hours / 24);

  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function getShippingProblems(
  order: ShippingOperationRowInput,
  sla: ShippingSlaConfig,
  now = new Date(),
) {
  const problems: Array<{ code: string; label: string; action: string }> = [];
  const isPaid = isOperationalPaidOrder(order);
  const trackingNumber = String(order.tracking_number || "").trim();
  const stateStartedAt = getShippingStateStartedAt(order);

  if (order.email_status === "failed") {
    problems.push({
      code: "shipping_email_failed",
      label: "Email de envío falló",
      action: "Reintentar email",
    });
  }

  if (order.fulfillment_status === "shipped" && !trackingNumber) {
    problems.push({
      code: "shipped_without_tracking",
      label: "Enviado sin guía",
      action: "Agregar guía o revisar shipment",
    });
  }

  if (trackingNumber && !isValidShippingTrackingNumber(trackingNumber)) {
    problems.push({
      code: "tracking_malformed",
      label: "Guía con formato inválido",
      action: "Corregir guía",
    });
  }

  if (order.fulfillment_status === "delivered" && !order.delivered_at) {
    problems.push({
      code: "delivered_without_timestamp",
      label: "Entregado sin fecha",
      action: "Revisar historial",
    });
  }

  if (isPaid && order.fulfillment_status === "unfulfilled") {
    const hours = getHoursSince(order.paid_at || stateStartedAt, now);

    if (hours > sla.prepareAttentionHours) {
      problems.push({
        code: "paid_unfulfilled_sla",
        label: "Pedido pagado detenido",
        action: "Comenzar preparación",
      });
    }
  }

  if (isPaid && order.fulfillment_status === "preparing") {
    const hours = getHoursSince(stateStartedAt, now);

    if (hours > sla.shippingAttentionHours) {
      problems.push({
        code: "preparing_sla",
        label: "Preparación demorada",
        action: "Agregar guía o enviar",
      });
    }
  }

  if (
    order.fulfillment_status !== "unfulfilled" &&
    order.fulfillment_status !== "preparing" &&
    order.fulfillment_status !== "ready_to_ship" &&
    order.fulfillment_status !== "shipped" &&
    order.fulfillment_status !== "delivered" &&
    order.fulfillment_status !== "cancelled"
  ) {
    problems.push({
      code: "invalid_fulfillment_status",
      label: "Fulfillment inválido",
      action: "Revisar orden",
    });
  }

  return problems;
}

export function isShippingToPrepare(order: ShippingOperationRowInput) {
  return isOrderToPrepare(order);
}

export function isShippingPreparing(order: ShippingOperationRowInput) {
  return order.fulfillment_status === "preparing" || order.fulfillment_status === "ready_to_ship";
}

export function isShippingNeedsGuide(order: ShippingOperationRowInput) {
  return isOperationalPaidOrder(order) && isShippingPreparing(order) && !String(order.tracking_number || "").trim();
}

export function matchesShippingView(
  order: ShippingOperationRowInput,
  view: AdminShippingView,
  sla: ShippingSlaConfig,
  now = new Date(),
) {
  if (view === "all") {
    return true;
  }

  if (view === "attention") {
    return (
      getShippingProblems(order, sla, now).length > 0 ||
      isShippingNeedsGuide(order) ||
      isShippingToPrepare(order)
    );
  }

  if (view === "problems") {
    return getShippingProblems(order, sla, now).length > 0;
  }

  if (view === "to_prepare") {
    return isShippingToPrepare(order);
  }

  if (view === "preparing") {
    return isShippingPreparing(order);
  }

  if (view === "shipped") {
    return order.fulfillment_status === "shipped";
  }

  return order.fulfillment_status === "delivered";
}

export function getShippingActionCounts(
  orders: ShippingOperationRowInput[],
  sla: ShippingSlaConfig,
  now = new Date(),
): ShippingActionCounts {
  return orders.reduce(
    (counts, order) => {
      counts.all += 1;

      if (matchesShippingView(order, "attention", sla, now)) {
        counts.attention += 1;
      }

      if (isShippingToPrepare(order)) {
        counts.toPrepare += 1;
      }

      if (isShippingPreparing(order)) {
        counts.preparing += 1;
      }

      if (isShippingNeedsGuide(order)) {
        counts.needsGuide += 1;
      }

      if (order.fulfillment_status === "shipped") {
        counts.shipped += 1;
      }

      if (order.fulfillment_status === "delivered") {
        counts.delivered += 1;
      }

      if (getShippingProblems(order, sla, now).length > 0) {
        counts.problems += 1;
      }

      return counts;
    },
    {
      attention: 0,
      toPrepare: 0,
      preparing: 0,
      needsGuide: 0,
      shipped: 0,
      delivered: 0,
      problems: 0,
      all: 0,
    },
  );
}

export function getShippingPriority(
  order: ShippingOperationRowInput,
  sla: ShippingSlaConfig,
  now = new Date(),
) {
  if (getShippingProblems(order, sla, now).length > 0) {
    return 0;
  }

  if (isShippingNeedsGuide(order)) {
    return 1;
  }

  if (isShippingToPrepare(order)) {
    return 2;
  }

  if (order.fulfillment_status === "shipped") {
    return 3;
  }

  if (order.fulfillment_status === "delivered") {
    return 4;
  }

  return 5;
}

export function sortShippingQueue<T extends ShippingOperationRowInput>(
  orders: T[],
  sla: ShippingSlaConfig,
  now = new Date(),
) {
  return [...orders].sort((a, b) => {
    const priority = getShippingPriority(a, sla, now) - getShippingPriority(b, sla, now);

    if (priority !== 0) {
      return priority;
    }

    if (a.fulfillment_status === "preparing" || a.fulfillment_status === "unfulfilled") {
      return String(getShippingStateStartedAt(a)).localeCompare(String(getShippingStateStartedAt(b)));
    }

    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

export function parseShippingView(value: string | undefined | null): AdminShippingView {
  return ADMIN_SHIPPING_VIEWS.includes(value as AdminShippingView)
    ? (value as AdminShippingView)
    : "attention";
}

export function getEstimatedDeliveryCopy({
  minDays,
  maxDays,
  businessDays,
}: {
  minDays: number;
  maxDays: number;
  businessDays: boolean;
}) {
  return `${minDays}–${maxDays} ${businessDays ? "días hábiles" : "días"}`;
}

export function parseAttributionTouch(value: string | undefined | null): "first" | "last" {
  return value === "first" ? "first" : "last";
}

export function getAttributionTouchValue(
  attribution: AttributionOrderSnapshot,
  touch: "first" | "last",
  field: "source" | "medium" | "campaign" | "content" | "term" | "referrer" | "landing_path" | "landing_url",
) {
  return attribution[`${touch}_touch_${field}` as keyof AttributionOrderSnapshot] || "";
}

export function getAttributionOrderSnapshotFromMetadata(metadata: unknown): AttributionOrderSnapshot | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const attribution = (metadata as { attribution?: Partial<AttributionOrderSnapshot> }).attribution;

  if (!attribution || typeof attribution !== "object") {
    return null;
  }

  const now = new Date().toISOString();

  return {
    first_touch_source: String(attribution.first_touch_source || "direct"),
    first_touch_medium: String(attribution.first_touch_medium || "none"),
    first_touch_campaign: String(attribution.first_touch_campaign || ""),
    first_touch_content: String(attribution.first_touch_content || ""),
    first_touch_term: String(attribution.first_touch_term || ""),
    first_touch_referrer: String(attribution.first_touch_referrer || ""),
    first_touch_landing_path: String(attribution.first_touch_landing_path || "/"),
    first_touch_landing_url: String(attribution.first_touch_landing_url || ""),
    first_seen_at: String(attribution.first_seen_at || now),
    last_touch_source: String(attribution.last_touch_source || "direct"),
    last_touch_medium: String(attribution.last_touch_medium || "none"),
    last_touch_campaign: String(attribution.last_touch_campaign || ""),
    last_touch_content: String(attribution.last_touch_content || ""),
    last_touch_term: String(attribution.last_touch_term || ""),
    last_touch_referrer: String(attribution.last_touch_referrer || ""),
    last_touch_landing_path: String(attribution.last_touch_landing_path || "/"),
    last_touch_landing_url: String(attribution.last_touch_landing_url || ""),
    last_seen_at: String(attribution.last_seen_at || now),
  };
}

export function matchesOrderFilter(order: {
  payment_status: string;
  fulfillment_status: string;
  status: string;
  tracking_number?: string | null;
  shipment?: { tracking_number?: string | null } | null;
  shipments?: Array<{ tracking_number?: string | null }> | null;
}, filter: AdminOrderFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "attention") {
    return isOrderRequiringAttention(order);
  }

  if (filter === "to_prepare") {
    return isOrderToPrepare(order);
  }

  if (filter === "preparing") {
    return order.fulfillment_status === "preparing" || order.status === "preparing";
  }

  if (filter === "shipped") {
    return order.fulfillment_status === "shipped" || order.status === "shipped";
  }

  if (filter === "delivered") {
    return order.fulfillment_status === "delivered" || order.status === "delivered";
  }

  return order.status === "cancelled" || order.fulfillment_status === "cancelled";
}

export function isValidPaidOrder(order: {
  payment_status: string;
  status?: string | null;
  refunded_at?: string | null;
  cancelled_at?: string | null;
}) {
  return (
    order.payment_status === "paid" &&
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    !order.cancelled_at &&
    !order.refunded_at
  );
}

export function getCustomerSegment({
  paidOrders,
  lifetimeSpendCents,
  vipSpendThresholdCents,
}: {
  paidOrders: number;
  lifetimeSpendCents: number;
  vipSpendThresholdCents?: number | null;
}): CustomerSegment {
  if (paidOrders >= 4) {
    return "vip";
  }

  if (vipSpendThresholdCents && lifetimeSpendCents >= vipSpendThresholdCents) {
    return "vip";
  }

  if (paidOrders >= 2) {
    return "returning";
  }

  return "new";
}

export function getAverageOrderValueCents(revenueCents: number, paidOrders: number) {
  return paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0;
}

export function parseCustomerSegment(value: string): CustomerSegmentFilter {
  return CUSTOMER_SEGMENTS.includes(value as CustomerSegmentFilter)
    ? (value as CustomerSegmentFilter)
    : "all";
}

export function parseCustomerSort(value: string): CustomerSort {
  return CUSTOMER_SORTS.includes(value as CustomerSort) ? (value as CustomerSort) : "last_order";
}

export function parseAnalyticsRange(value: string): AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange) ? (value as AnalyticsRange) : "30d";
}

export function getAnalyticsRangeStart(
  range: AnalyticsRange,
  now = new Date(),
  timeZone = "America/Mexico_City",
) {
  const start = getMexicoStartOfDay(now, timeZone);

  if (range === "today") {
    return start;
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  start.setDate(start.getDate() - (days - 1));

  return start;
}

export function getPreviousRangeStart(range: AnalyticsRange, currentStart: Date) {
  const previous = new Date(currentStart);

  if (range === "today") {
    previous.setDate(previous.getDate() - 1);
    return previous;
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  previous.setDate(previous.getDate() - days);

  return previous;
}

export function getMexicoStartOfDay(value: string | Date, timeZone = "America/Mexico_City") {
  return getZonedStartOfDay(new Date(value), timeZone);
}

export function getMexicoEndOfDay(value: string | Date, timeZone = "America/Mexico_City") {
  const end = getMexicoStartOfDay(value, timeZone);
  end.setDate(end.getDate() + 1);

  return end;
}

export function formatMexicoDayKey(value: string | Date, timeZone = "America/Mexico_City") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function getZonedStartOfDay(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);

  return new Date(utcGuess.getTime() - offset);
}

function getTimeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const zonedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return zonedAsUtc - value.getTime();
}

export function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

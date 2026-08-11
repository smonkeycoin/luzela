export const orderStatuses = [
  "draft",
  "pending_payment",
  "paid",
  "preparing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  paid: ["preparing", "cancelled", "refunded"],
  preparing: ["ready_to_ship", "cancelled", "refunded"],
  ready_to_ship: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return allowedTransitions[from].includes(to);
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function syncCustomerPaidOrderStats(customerId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase service role is not configured.");
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, total_cents, paid_at, created_at, order_items(physical_units, quantity, units_per_pack)")
    .eq("customer_id", customerId)
    .eq("payment_status", "paid");

  if (ordersError) {
    throw ordersError;
  }

  const lifetimeValueCents = (orders || []).reduce(
    (sum, order) => sum + Number(order.total_cents || 0),
    0,
  );
  const unitsPurchased = (orders || []).reduce((sum, order) => {
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    return (
      sum +
      items.reduce(
        (itemSum, item) =>
          itemSum +
          Number(item.physical_units || Number(item.quantity || 0) * Number(item.units_per_pack || 1)),
        0,
      )
    );
  }, 0);
  const lastOrderAt =
    [...(orders || [])]
      .map((order) => order.paid_at || order.created_at)
      .filter(Boolean)
      .sort()
      .at(-1) || null;

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      lifetime_value_cents: lifetimeValueCents,
      units_purchased: unitsPurchased,
      last_order_at: lastOrderAt,
    })
    .eq("id", customerId);

  if (updateError) {
    throw updateError;
  }

  return {
    customerId,
    lifetimeValueCents,
    unitsPurchased,
    lastOrderAt,
  };
}

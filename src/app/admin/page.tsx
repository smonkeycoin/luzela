import { getAdminDashboard } from "@/lib/admin/queries";
import { getShippingPolicy } from "@/lib/settings";

import { AdminDashboard } from "./admin-dashboard";

export default async function AdminDashboardPage() {
  const [dashboard, shippingPolicy] = await Promise.all([
    getAdminDashboard(),
    getShippingPolicy(),
  ]);
  const { metrics, pending, recentOrders, orderCounts, salesByProduct, activity, error } =
    dashboard;

  return (
    <>
      {error ? (
        <div className="mx-4 mt-5 rounded-[12px] border border-[#f1d1c8] bg-white p-4 text-sm font-semibold text-[#9a392b] sm:mx-6 lg:mx-8">
          {error}
        </div>
      ) : null}
      <AdminDashboard
        metrics={metrics}
        pending={pending}
        orders={recentOrders}
        orderCounts={orderCounts}
        salesByProduct={salesByProduct}
        activity={activity}
        shippingCarrier={shippingPolicy.carrierDisplayName}
      />
    </>
  );
}

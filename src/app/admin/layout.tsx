import type { ReactNode } from "react";

import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminShell } from "@/lib/admin/queries";

import { AdminShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [adminSession, shell] = await Promise.all([requireAdminSession(), getAdminShell()]);
  const dateLabel = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <AdminShell
      role={adminSession.admin.role}
      pendingOrders={shell.pendingOrders}
      notificationCount={shell.notificationCount}
      notificationItems={shell.notificationItems}
      searchItems={shell.searchItems}
      dateLabel={dateLabel}
    >
      {children}
    </AdminShell>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  CreditCard,
  Home,
  LogOut,
  Package,
  Settings,
  Truck,
  Users,
} from "lucide-react";

import { requireAdminSession } from "@/lib/auth/admin";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/orders", label: "Orders", icon: CreditCard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/shipping", label: "Shipping", icon: Truck },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminSession = await requireAdminSession();

  return (
    <div className="min-h-screen bg-[#f3f1ea] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-[var(--line)] bg-[var(--ink)] p-4 text-white lg:min-h-screen lg:border-b-0">
        <div className="flex items-center justify-between lg:block">
          <Link href="/" className="text-lg font-semibold">
            Luzela Admin
          </Link>
          <span className="rounded-[8px] bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 lg:mt-3 lg:inline-block">
            {adminSession.admin.role}
          </span>
        </div>
        <nav className="mt-5 flex gap-2 overflow-x-auto lg:grid">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring inline-flex min-w-fit items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
            >
              <item.icon size={18} aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/auth/logout"
          className="focus-ring mt-4 inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut size={18} aria-hidden />
          Logout
        </Link>
      </aside>
      <div>{children}</div>
    </div>
  );
}

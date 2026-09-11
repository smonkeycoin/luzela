"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Home,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { AdminNotificationItem, AdminSearchItem } from "@/lib/admin/queries";

const adminNav = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/orders", label: "Órdenes", icon: CreditCard },
  { href: "/admin/customers", label: "Clientes", icon: Users },
  { href: "/admin/products", label: "Productos", icon: Package },
  { href: "/admin/inventory", label: "Inventario", icon: Boxes },
  { href: "/admin/shipping", label: "Envíos", icon: Truck },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/collaborations", label: "Colaboraciones", icon: Users },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
];

const typeLabels: Record<AdminSearchItem["type"], string> = {
  order: "ORDERS",
  customer: "CUSTOMERS",
  product: "PRODUCTS",
};

export function AdminShell({
  children,
  role,
  pendingOrders,
  notificationCount,
  notificationItems,
  searchItems,
  dateLabel,
}: {
  children: ReactNode;
  role: string;
  pendingOrders: number;
  notificationCount: number;
  notificationItems: AdminNotificationItem[];
  searchItems: AdminSearchItem[];
  dateLabel: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const filteredSearch = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return searchItems.slice(0, 8);
    }

    return searchItems
      .filter((item) =>
        [item.label, item.description, item.type].join(" ").toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [search, searchItems]);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#171310] lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <button
        type="button"
        className="focus-ring fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#e8dfd5] bg-white text-[#163f3b] shadow-[0_10px_30px_rgba(23,19,16,0.08)] lg:hidden"
        onClick={() => setMobileOpen((value) => !value)}
        aria-label="Abrir navegación"
      >
        {mobileOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[224px] flex-col border-r border-[#e8dfd5] bg-[#fffdf8] px-3 py-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href="/admin"
          className="focus-ring mx-2 text-lg font-semibold tracking-[0.08em] text-[#173f3a]"
          onClick={() => setMobileOpen(false)}
        >
          LUZELA
        </Link>
        <nav className="mt-7 grid gap-1">
          {adminNav.map((item) => {
            const isActive =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const href =
              item.href === "/admin/orders" && pendingOrders > 0
                ? "/admin/orders?filter=attention"
                : item.href;

            return (
              <Link
                key={item.href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`focus-ring inline-flex h-10 items-center justify-between rounded-[10px] px-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#dff1ed] text-[#0f5f58]"
                    : "text-[#716a63] hover:bg-[#f6f1e9] hover:text-[#173f3a]"
                }`}
              >
                <span className="inline-flex items-center gap-3">
                  <item.icon size={17} aria-hidden />
                  {item.label}
                </span>
                {item.href === "/admin/orders" && pendingOrders > 0 ? (
                  <span
                    className="rounded-full bg-[#0f766e] px-2 py-0.5 text-[11px] font-semibold text-white"
                    title="Órdenes pagadas que requieren acción operativa"
                    aria-label={`${pendingOrders} órdenes requieren atención`}
                  >
                    {pendingOrders}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-3">
          <div className="rounded-[12px] border border-[#eadfce] bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]">
              SUMMER DEAL
            </p>
            <p className="mt-1 text-sm font-semibold text-[#171310]">3X Luzelas</p>
            <Link
              href="/"
              className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0f766e]"
            >
              Ver en tienda <ExternalLink size={13} aria-hidden />
            </Link>
          </div>
          <div className="px-2 text-xs leading-5 text-[#716a63]">
            <p className="font-semibold text-[#171310]">¿Necesitas ayuda?</p>
            <p>Soporte de Luzela</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[#e8dfd5] bg-[#faf9f6]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_minmax(320px,520px)_auto] xl:items-center">
            <div className="pl-12 lg:pl-0">
              <h1 className="text-xl font-semibold text-[#171310]">Bienvenida, Luzela</h1>
              <p className="text-sm text-[#716a63]">Aquí está lo que está pasando hoy.</p>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#716a63]"
                aria-hidden
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                className="focus-ring h-11 w-full rounded-[12px] border border-[#e4dbcf] bg-white pl-10 pr-3 text-sm font-semibold text-[#171310] shadow-[0_1px_0_rgba(23,19,16,0.03)]"
                placeholder="Buscar órdenes, clientes, productos…"
              />
              {searchOpen ? (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-[12px] border border-[#e4dbcf] bg-white shadow-[0_18px_60px_rgba(23,19,16,0.12)]">
                  {filteredSearch.length ? (
                    filteredSearch.map((item) => (
                      <Link
                        key={`${item.type}-${item.id}`}
                        href={item.href}
                        onClick={() => {
                          setSearch("");
                          setSearchOpen(false);
                        }}
                        className="focus-ring block border-b border-[#f0e8de] px-4 py-3 last:border-0 hover:bg-[#faf7f1]"
                      >
                        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#0f766e]">
                          {typeLabels[item.type]}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#171310]">{item.label}</p>
                        <p className="mt-0.5 truncate text-xs text-[#716a63]">
                          {item.description || "Sin descripción"}
                        </p>
                      </Link>
                    ))
                  ) : (
                    <p className="px-4 py-4 text-sm text-[#716a63]">Sin resultados reales.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 xl:justify-end">
              <div className="hidden h-10 items-center rounded-full border border-[#e4dbcf] bg-white px-3 text-xs font-semibold text-[#716a63] sm:inline-flex">
                Hoy, {dateLabel}
              </div>
              <button
                type="button"
                onClick={() => setNotificationsOpen((value) => !value)}
                className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4dbcf] bg-white text-[#173f3a]"
                aria-label="Pendientes de atención"
                aria-expanded={notificationsOpen}
              >
                <Bell size={17} aria-hidden />
                {notificationCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-16 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-[#e4dbcf] bg-white shadow-[0_18px_60px_rgba(23,19,16,0.12)]">
                  <div className="border-b border-[#f0e8de] px-4 py-3">
                    <p className="text-sm font-semibold text-[#171310]">
                      Pendientes de atención
                    </p>
                    <p className="mt-1 text-xs text-[#716a63]">
                      Counts operativos conectados a filtros reales.
                    </p>
                  </div>
                  {notificationItems.some((item) => item.count > 0) ? (
                    notificationItems
                      .filter((item) => item.count > 0)
                      .map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setNotificationsOpen(false)}
                          className="focus-ring grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b border-[#f0e8de] px-4 py-3 last:border-0 hover:bg-[#faf7f1]"
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#dff1ed] text-sm font-semibold text-[#0f5f58]">
                            {item.count}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-[#171310]">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#716a63]">
                              Abrir vista filtrada
                            </span>
                          </span>
                        </Link>
                      ))
                  ) : (
                    <p className="px-4 py-5 text-sm font-semibold text-[#0f5f58]">Todo al día.</p>
                  )}
                </div>
              ) : null}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="focus-ring inline-flex h-10 items-center gap-2 rounded-full border border-[#e4dbcf] bg-white px-2 pr-3"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#dff1ed] text-xs font-semibold text-[#0f5f58]">
                    LA
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-semibold text-[#171310]">Luzela Admin</span>
                    <span className="block text-[11px] capitalize text-[#716a63]">{role}</span>
                  </span>
                  <ChevronDown size={14} className="text-[#716a63]" aria-hidden />
                </button>
                {profileOpen ? (
                  <div className="absolute right-0 top-12 w-44 overflow-hidden rounded-[12px] border border-[#e4dbcf] bg-white shadow-[0_18px_60px_rgba(23,19,16,0.12)]">
                    <Link
                      href="/admin/settings"
                      className="focus-ring block px-4 py-3 text-sm font-semibold text-[#171310] hover:bg-[#faf7f1]"
                    >
                      Configuración
                    </Link>
                    <Link
                      href="/auth/logout"
                      prefetch={false}
                      className="focus-ring flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#8d3326] hover:bg-[#faf7f1]"
                    >
                      <LogOut size={15} aria-hidden />
                      Cerrar sesión
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

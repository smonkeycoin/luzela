import Link from "next/link";
import { Menu, ShoppingBag } from "lucide-react";

const navItems = [
  { label: "Tienda", href: "/" },
  { label: "Nuestra historia", href: "https://about.luzela.mx" },
  { label: "FAQ", href: "/faq" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--background)]/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="focus-ring text-base font-semibold tracking-[0.12em] text-[var(--ink)]">
          LUZELA México
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="focus-ring hover:text-[var(--ink)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--line)] bg-white text-[var(--ink)]"
            aria-label="Carrito"
          >
            <ShoppingBag size={18} aria-hidden />
          </Link>
          <details className="relative md:hidden">
            <summary
              className="focus-ring flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-[8px] border border-[var(--line)] bg-white text-[var(--ink)] [&::-webkit-details-marker]:hidden"
              aria-label="Menu"
            >
              <Menu size={18} aria-hidden />
            </summary>
            <nav className="absolute right-0 top-12 z-20 grid min-w-48 gap-1 rounded-[8px] border border-[var(--line)] bg-white p-2 text-sm font-semibold shadow-lg">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="focus-ring rounded-[6px] px-3 py-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--ink)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

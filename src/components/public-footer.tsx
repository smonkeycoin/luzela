import Link from "next/link";

import { PaymentLogos } from "./payment-logos";

const footerColumns = [
  {
    title: "Comprar",
    links: [
      { label: "Tienda", href: "/" },
      { label: "Luzela SPF 50+", href: "/" },
      { label: "Luzela Dúo", href: "/" },
    ],
  },
  {
    title: "Luzela",
    links: [
      { label: "Nuestra historia", href: "https://about.luzela.mx" },
      { label: "FAQ", href: "/faq" },
      { label: "Contacto", href: "/#contacto" },
    ],
    text: ["Instagram"],
  },
  {
    title: "Ayuda",
    links: [
      { label: "Envíos", href: "/shipping" },
      { label: "Cambios y devoluciones", href: "/returns" },
      { label: "Privacidad", href: "/privacy" },
      { label: "Términos", href: "/terms" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer id="contacto" className="border-t border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <p className="text-base font-semibold tracking-[0.12em] text-[var(--ink)]">LUZELA</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
            Protección solar mineral hecha en México.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-semibold text-[var(--ink)]">{column.title}</h2>
              <ul className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link className="focus-ring hover:text-[var(--ink)]" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                {column.text?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 text-xs text-[var(--muted)] sm:px-8 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Luzela México.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span>Pago seguro:</span>
            <PaymentLogos compact />
          </div>
        </div>
      </div>
    </footer>
  );
}

import { CreditCard, LockKeyhole, ShieldCheck, Truck } from "lucide-react";

const trustItems = [
  { icon: CreditCard, label: "Pago seguro" },
  { icon: LockKeyhole, label: "Conexión SSL" },
  { icon: ShieldCheck, label: "Pago protegido por Mercado Pago" },
  { icon: Truck, label: "Envíos a todo México" },
];

export function TrustBar() {
  return (
    <div className="grid gap-2 border-y border-[var(--line)] py-4 sm:grid-cols-2 lg:grid-cols-4">
      {trustItems.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
          <item.icon size={16} className="text-[var(--ink)]" aria-hidden />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

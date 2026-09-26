import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { MetaPaidPurchase } from "@/components/meta-paid-purchase";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ checkout_session?: string }> }) {
  const { checkout_session: sessionId } = await searchParams;
  return (
    <main className="min-h-screen">
      <MetaPaidPurchase checkoutSessionId={sessionId && /^[0-9a-f-]{36}$/i.test(sessionId) ? sessionId : null} />
      <PublicHeader />
      <div className="grid min-h-[70vh] place-items-center px-4 py-12">
        <section className="surface max-w-xl rounded-[8px] p-8 text-center">
          <ShieldCheck className="mx-auto text-[var(--teal)]" size={42} aria-hidden />
          <h1 className="mt-5 text-3xl font-semibold">Pedido recibido</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            Gracias por comprar Luzela. Estamos confirmando tu pago de forma
            segura y prepararemos tu pedido en cuanto quede listo.
          </p>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
            <ShieldCheck size={16} className="text-[var(--ink)]" aria-hidden />
            Pago en validación segura
          </div>
          <Link
            href="/"
            className="focus-ring mt-6 inline-flex h-11 items-center justify-center bg-[var(--ink)] px-5 text-sm font-semibold text-white"
          >
            Ir al inicio
          </Link>
        </section>
      </div>
      <PublicFooter />
    </main>
  );
}

import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";

import { MercadoPagoCardPayment } from "@/components/mercadopago-card-payment";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getMercadoPagoPublicKey } from "@/lib/mercadopago/client";
import { formatMoney } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function CheckoutPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout_session?: string }>;
}) {
  const { checkout_session: checkoutSessionId } = await searchParams;
  const supabase = createSupabaseAdminClient();
  const publicKey = getMercadoPagoPublicKey();

  const { data: checkoutSession } =
    supabase && checkoutSessionId
      ? await supabase
          .from("checkout_sessions")
          .select("id, order_id, email")
          .eq("id", checkoutSessionId)
          .eq("provider", "mercadopago")
          .maybeSingle()
      : { data: null };

  const { data: order } =
    supabase && checkoutSession?.order_id
      ? await supabase
          .from("orders")
          .select("id, order_number, subtotal_cents, discount_cents, discount_code, shipping_cents, total_cents, currency, order_items(name, quantity, unit_price_cents, metadata)")
          .eq("id", checkoutSession.order_id)
          .maybeSingle()
      : { data: null };

  const totalCents = (order?.total_cents as number | undefined) || 0;
  const currency = (order?.currency as string | undefined) || "mxn";
  const amount = totalCents / 100;
  const email = (checkoutSession?.email as string | undefined) || "";

  return (
    <main className="min-h-screen bg-[#f7f6f1]">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <Link
          href="/checkout"
          className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={18} aria-hidden />
          Volver
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="surface rounded-[8px] p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              COMPRA SEGURA
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
              Pago seguro
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Finaliza tu pedido Luzela sin salir de esta página.
            </p>

            <div className="mt-7">
              {checkoutSession && order ? (
                <MercadoPagoCardPayment
                  amount={amount}
                  checkoutSessionId={checkoutSession.id as string}
                  email={email}
                  publicKey={publicKey}
                />
              ) : (
                <div className="rounded-[8px] border border-[var(--line)] bg-white p-5 text-sm font-semibold text-[var(--coral)]">
                  No pudimos encontrar esta sesión de checkout.
                </div>
              )}
            </div>
          </section>

          <aside className="surface h-fit rounded-[8px] p-5">
            <div className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
              <ShoppingBag size={16} className="text-[var(--ink)]" aria-hidden />
              Resumen Luzela
            </div>
            <h2 className="mt-5 text-lg font-semibold text-[var(--ink)]">
              {order?.order_number || "Pedido Luzela"}
            </h2>
            <div className="mt-5 grid gap-3 border-y border-[var(--line)] py-4 text-sm">
              {(Array.isArray(order?.order_items) ? order?.order_items : []).map((item) => (
                <div key={`${item.name}-${item.quantity}`} className="flex justify-between gap-4">
                  <div>
                    <span className="text-[var(--muted)]">{item.name as string}</span>
                    {isPromotionalItem(item) ? (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-[var(--muted)] line-through">
                          {formatMoney(
                            Number(item.metadata.original_price_cents),
                            currency,
                          )}
                        </p>
                        <p className="text-sm font-semibold text-[var(--teal)]">
                          {formatMoney(Number(item.unit_price_cents), currency)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <span className="font-semibold">x{item.quantity as number}</span>
                </div>
              ))}
            </div>
            {order ? <dl className="mt-4 grid gap-3 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal_cents,currency)}</dd></div>{order.discount_cents>0?<div className="flex justify-between text-[var(--teal)]"><dt>{order.discount_code}</dt><dd>−{formatMoney(order.discount_cents,currency)}</dd></div>:null}<div className="flex justify-between"><dt>Envío</dt><dd>{order.shipping_cents?formatMoney(order.shipping_cents,currency):'Incluido'}</dd></div></dl>:null}
            <div className="mt-5 flex justify-between gap-4 text-sm">
              <span className="text-[var(--ink)]">Total</span>
              <span className="font-semibold">
                {order ? formatMoney(totalCents, order.currency as string) : "Pendiente"}
              </span>
            </div>
          </aside>
        </div>
      </div>
      <PublicFooter />
    </main>
  );
}

function isPromotionalItem(item: {
  metadata?: unknown;
  unit_price_cents?: number | null;
}) {
  if (!item.metadata || typeof item.metadata !== "object") {
    return false;
  }

  const metadata = item.metadata as {
    offer_active?: unknown;
    offer_price_cents?: unknown;
    original_price_cents?: unknown;
  };

  return (
    metadata.offer_active === true &&
    Number(metadata.offer_price_cents || 0) > 0 &&
    Number(metadata.original_price_cents || 0) > Number(item.unit_price_cents || 0)
  );
}

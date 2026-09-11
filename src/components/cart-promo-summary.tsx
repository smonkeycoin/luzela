"use client";

import Link from "next/link";
import { MANUAL_CART_CODE_KEY } from "@/lib/collabs/manual-cart-code";
import { CheckoutPromoField, CheckoutPromoProvider, CheckoutPromoTotals, useCheckoutPromo } from "./checkout-promo";

function ContinueToCheckout({ variant, quantity }: { variant: string; quantity: number }) {
  const promo = useCheckoutPromo();
  return (
    <Link
      href={`/checkout?variant=${variant}&quantity=${quantity}`}
      aria-disabled={promo?.pending}
      onClick={(event) => {
        if (promo?.pending) { event.preventDefault(); return; }
        try {
          sessionStorage.removeItem(MANUAL_CART_CODE_KEY);
          if (promo?.quote) sessionStorage.setItem(MANUAL_CART_CODE_KEY, JSON.stringify({
            variant, code: promo.quote.code, appliedAt: Date.now(),
          }));
        } catch { /* Checkout still accepts manual entry if storage is unavailable. */ }
      }}
      className="focus-ring mt-6 inline-flex h-12 w-full items-center justify-center bg-[var(--ink)] px-5 text-sm font-semibold text-white aria-disabled:opacity-50"
    >
      Continuar al checkout
    </Link>
  );
}

export function CartPromoSummary({ variant, quantity, price, currency }: {
  variant: string; quantity: number; price: number; currency: string;
}) {
  return (
    <CheckoutPromoProvider key={variant} variant={variant} initialQuantity={quantity} quantityOverride={quantity}>
      <dl className="mt-4 grid gap-4 text-sm">
        <CheckoutPromoTotals unitPrice={price} shipping={0} currency={currency} />
      </dl>
      <div className="mt-5"><CheckoutPromoField /></div>
      <ContinueToCheckout variant={variant} quantity={quantity} />
    </CheckoutPromoProvider>
  );
}

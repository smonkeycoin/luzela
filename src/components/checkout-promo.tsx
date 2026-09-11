"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formatMoney } from "@/lib/money";
import { MANUAL_CART_CODE_KEY, readManualCartCode } from "@/lib/collabs/manual-cart-code";
type Quote = {
  code: string;
  discountCents: number;
  percent: number;
  subtotalCents: number;
};
type Context = {
  quantity: number;
  setQuantity: (n: number) => void;
  quote: Quote | null;
  pending: boolean;
  error: string;
  apply: (code: string) => Promise<void>;
  remove: () => void;
};
const PromoContext = createContext<Context | null>(null);
export function useCheckoutPromo() {
  return useContext(PromoContext);
}
export function CheckoutPromoProvider({
  children,
  variant,
  initialQuantity,
  quantityOverride,
  acceptManualCartCode = false,
}: {
  children: ReactNode;
  variant: string;
  initialQuantity: number;
  quantityOverride?: number;
  acceptManualCartCode?: boolean;
}) {
  const [localQuantity, setQuantity] = useState(initialQuantity);
  const quantity = quantityOverride ?? localQuantity;
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const selected = useRef("");
  async function requestQuote(code: string, qty: number) {
    const id = ++requestId.current;
    setPending(true);
    setQuote(null);
    setError("");
    try {
      const response = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, variant, quantity: qty }),
      });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) {
        setError(data.error || "No pudimos validar el código.");
        return;
      }
      setQuote(data);
    } catch {
      if (id === requestId.current)
        setError("No pudimos validar el código. Inténtalo de nuevo.");
    } finally {
      if (id === requestId.current) setPending(false);
    }
  }
  useEffect(() => {
    if (!acceptManualCartCode) return;
    let code = "";
    try {
      code = readManualCartCode(sessionStorage.getItem(MANUAL_CART_CODE_KEY), variant);
      sessionStorage.removeItem(MANUAL_CART_CODE_KEY);
    } catch {}
    if (code) {
      selected.current = code;
      // Revalidate the customer's explicit cart selection against the server.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void requestQuote(code, initialQuantity);
    }
    // The provider is keyed by variant; consume the one-time handoff on checkout entry only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptManualCartCode, variant]);
  useEffect(() => {
    if (quantityOverride !== undefined && selected.current) {
      // A cart quantity edit needs a new authoritative quote.
      void requestQuote(selected.current, quantityOverride);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantityOverride]);
  function changeQuantity(n: number) {
    setQuantity(n);
    if (selected.current) void requestQuote(selected.current, n);
  }
  async function apply(code: string) {
    selected.current = code.trim().toUpperCase();
    await requestQuote(selected.current, quantity);
  }
  function remove() {
    ++requestId.current;
    selected.current = "";
    setQuote(null);
    setError("");
    setPending(false);
  }
  return (
    <PromoContext.Provider
      value={{
        quantity,
        setQuantity: changeQuantity,
        quote,
        pending,
        error,
        apply,
        remove,
      }}
    >
      {children}
    </PromoContext.Provider>
  );
}
export function CheckoutPromoField() {
  const context = useCheckoutPromo();
  const [code, setCode] = useState("");
  if (!context) return null;
  return (
    <fieldset className="min-w-0 rounded-lg border border-[var(--line)] bg-white p-4">
      <legend className="px-1 text-sm font-semibold">
        Código de descuento
      </legend>
      <div className="flex gap-2">
        <input
          aria-label="Código de descuento"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Introduce tu código"
          maxLength={64}
          className="focus-ring h-11 min-w-0 flex-1 rounded border border-[var(--line)] px-3 uppercase"
        />
        <button
          type="button"
          disabled={context.pending || !code.trim()}
          onClick={() => void context.apply(code)}
          className="focus-ring rounded bg-[var(--ink)] px-4 text-sm text-white disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
      <input
        type="hidden"
        name="coupon_code"
        value={context.quote?.code || ""}
      />
      <div aria-live="polite" className="mt-3 text-sm">
        {context.pending ? (
          "Validando beneficio…"
        ) : context.quote ? (
          <p className="text-[var(--teal)]">
            ✓ Descuento aplicado ·{" "}
            {context.quote.percent}% de descuento
          </p>
        ) : context.error ? (
          <p className="text-[var(--coral)]">
            {context.error} Tu compra continúa sin cupón.
          </p>
        ) : null}
      </div>
      {context.quote || context.error ? (
        <button
          type="button"
          className="mt-2 text-xs underline"
          onClick={context.remove}
        >
          Quitar código
        </button>
      ) : null}
    </fieldset>
  );
}
export function CheckoutPromoTotals({
  unitPrice,
  shipping,
  currency,
}: {
  unitPrice: number;
  shipping: number;
  currency: string;
}) {
  const context = useCheckoutPromo();
  const subtotal = context?.quote?.subtotalCents ?? unitPrice * (context?.quantity || 1);
  const discount = context?.quote?.discountCents || 0;
  return (
    <>
      <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
        <dt>Subtotal</dt>
        <dd>{formatMoney(subtotal, currency)}</dd>
      </div>
      {discount > 0 ? (
        <div className="flex justify-between gap-4 text-[var(--teal)]">
          <dt>Descuento</dt>
          <dd>−{formatMoney(discount, currency)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <dt>Envío</dt>
        <dd>{shipping ? formatMoney(shipping, currency) : "Incluido"}</dd>
      </div>
      <div className="flex justify-between gap-4 border-y border-[var(--line)] py-3 font-semibold">
        <dt>Total</dt>
        <dd>
          {context?.pending
            ? "Validando…"
            : formatMoney(subtotal - discount + shipping, currency)}
        </dd>
      </div>
    </>
  );
}

export function CheckoutQuantitySummary({
  quantity: initialQuantity,
  unitsPerPack,
}: {
  quantity: number;
  unitsPerPack: number;
}) {
  const context = useCheckoutPromo();
  const quantity = context?.quantity ?? initialQuantity;
  const physicalUnits = unitsPerPack * quantity;
  return (
    <>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Cantidad: {quantity} pack{quantity === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {physicalUnits} Luzela{physicalUnits === 1 ? "" : "s"} físicas
      </p>
      {unitsPerPack >= 10 ? (
        <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
          Incluye: {physicalUnits} piezas
        </p>
      ) : null}
    </>
  );
}

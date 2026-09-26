"use client";

import { useCheckoutPromo } from "./checkout-promo";
import { currentAnalyticsSessionId, isAnalyticsQa } from "@/lib/analytics/client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";

type CheckoutSubmitState = {
  disabled: boolean;
  submitting: boolean;
};

const CheckoutSubmitContext = createContext<CheckoutSubmitState>({
  disabled: false,
  submitting: false,
});

type CheckoutFormProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
  disabled?: boolean;
};

export function CheckoutForm({
  children,
  disabled = false,
  onSubmit,
  ...props
}: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [error,setError] = useState("");
  const promo = useCheckoutPromo();
  const submitDisabled = disabled || submitting || Boolean(promo?.pending);

  return (
    <CheckoutSubmitContext.Provider
      value={{ disabled: submitDisabled, submitting }}
    >
      <form
        {...props}
        onChange={(event) => {
          const target = event.target;
          if(target instanceof HTMLInputElement && target.name === 'quantity') promo?.setQuantity(Number(target.value));
        }}
        onSubmit={(event) => {
          if(promo?.pending){event.preventDefault();return;}
          onSubmit?.(event);

          if (event.defaultPrevented) {
            return;
          }

          if (submittedRef.current) {
            event.preventDefault();
            return;
          }

          if (!event.currentTarget.checkValidity()) {
            return;
          }

          event.preventDefault();
          submittedRef.current = true;
          setSubmitting(true);setError('');
          const form = event.currentTarget;
          const body = new FormData(form);
          body.set("analytics_session_id", currentAnalyticsSessionId());
          body.set("analytics_is_qa", isAnalyticsQa() ? "true" : "false");
          void fetch('/api/checkout', {method:'POST',body,headers:{Accept:'application/json'}}).then(async response=>{
            const data=await response.json();
            if(response.ok && data.url){
              const destination = new URL(data.url, window.location.href);
              // Keep the first-party analytics session on this storefront origin
              // when the server's configured checkout URL uses a canonical host.
              const url = destination.pathname === "/checkout/payment"
                ? `${destination.pathname}${destination.search}${destination.hash}`
                : data.url;
              window.location.assign(url);
              return;
            }
            setError(data.detail || 'No pudimos iniciar el pago. Revisa tus datos e inténtalo de nuevo.');
            const key=form.elements.namedItem('idempotency_key');
            if(key instanceof HTMLInputElement && data.error !== 'checkout_attempt_in_progress')key.value=crypto.randomUUID();
            submittedRef.current=false;setSubmitting(false);
          }).catch(()=>{setError('No pudimos confirmar la solicitud. Inténtalo de nuevo.');submittedRef.current=false;setSubmitting(false);});
        }}
      >
        {children}
        {error ? <p role="alert" className="text-sm text-[var(--coral)]">{error}</p> : null}
      </form>
    </CheckoutSubmitContext.Provider>
  );
}

export function useCheckoutSubmitState() {
  return useContext(CheckoutSubmitContext);
}

"use client";

import { LockKeyhole } from "lucide-react";

import { useCheckoutSubmitState } from "@/components/checkout-form";

export function CheckoutSubmitButton({ disabled }: { disabled: boolean }) {
  const submitState = useCheckoutSubmitState();
  const isDisabled = disabled || submitState.disabled;

  return (
    <button
      className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[var(--ink)] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      type="submit"
      disabled={isDisabled}
      aria-busy={submitState.submitting ? "true" : "false"}
    >
      <LockKeyhole size={18} aria-hidden />
      {submitState.submitting ? "Preparando pago..." : "Continuar a pago seguro"}
    </button>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { hasMarketingConsent, MARKETING_CONSENT_KEY, subscribeMarketingConsent } from "./meta-pixel";

export function MarketingConsent() {
  const granted = useSyncExternalStore(subscribeMarketingConsent, hasMarketingConsent, () => false);
  function choose(value: boolean) {
    try {
      localStorage.setItem(MARKETING_CONSENT_KEY, value ? "granted" : "denied");
      location.reload();
    } catch { /* Browser storage may be unavailable. */ }
  }
  return <div className="mt-5 border-t border-[var(--line)] pt-5">
    <h3 className="text-sm font-semibold">Medición de marketing</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Meta Pixel se activa solo con tu permiso y si está configurado. Puedes retirar tu permiso aquí.</p>
    <div className="mt-3 flex gap-3">
      <button type="button" onClick={() => choose(true)} aria-pressed={granted} className="rounded-[8px] border border-[var(--line)] px-3 py-2 text-sm">Permitir</button>
      <button type="button" onClick={() => choose(false)} aria-pressed={!granted} className="rounded-[8px] border border-[var(--line)] px-3 py-2 text-sm">Rechazar</button>
    </div>
  </div>;
}

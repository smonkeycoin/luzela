"use client";

import { useEffect } from "react";
import { currentAnalyticsSessionId } from "@/lib/analytics/client";
import { hasMarketingConsent } from "./meta-pixel";

export function MetaPaidPurchase({ checkoutSessionId }: { checkoutSessionId: string | null }) {
  useEffect(() => {
    if (!checkoutSessionId || !process.env.NEXT_PUBLIC_META_PIXEL_ID || !hasMarketingConsent()) return;
    let stopped = false;
    let tries = 0;
    const poll = async () => {
      if (stopped || tries++ >= 24) return;
      try {
        const response = await fetch("/api/analytics/purchase-status", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ checkout_session_id: checkoutSessionId, anonymous_session_id: currentAnalyticsSessionId() }) });
        const result = response.ok ? await response.json() as { paid?: boolean; event_id?: string; value?: number; currency?: string } : null;
        if (result?.paid && result.event_id && window.fbq) {
          const key = `luzela_meta_${result.event_id}`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, "1");
            window.fbq("track", "Purchase", { value: result.value, currency: result.currency }, { eventID: result.event_id });
          }
          return;
        }
      } catch { /* Meta never affects order confirmation. */ }
      if (!stopped) timer = window.setTimeout(poll, 5000);
    };
    let timer = window.setTimeout(poll, 1000);
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [checkoutSessionId]);
  return null;
}

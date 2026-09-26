"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
export const MARKETING_CONSENT_KEY = "luzela_marketing_consent_v1";

export function hasMarketingConsent() {
  try { return localStorage.getItem(MARKETING_CONSENT_KEY) === "granted"; }
  catch { return false; }
}

export function subscribeMarketingConsent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function MetaPixel() {
  const path=usePathname();
  const lastPageView = useRef<string | null>(null);
  const privatePage=/^\/(admin|collab|auth)(\/|$)/.test(path);
  const consented = useSyncExternalStore(subscribeMarketingConsent, hasMarketingConsent, () => false);
  const trackPageView = useCallback(() => {
    if (window.fbq && lastPageView.current !== path) {
      window.fbq("track", "PageView");
      lastPageView.current = path;
    }
  }, [path]);
  useEffect(() => {
    if (!pixelId || privatePage || !consented) {
      return;
    }
    trackPageView();
  }, [privatePage, consented, trackPageView]);

  if (!pixelId || privatePage || !consented) {
    return null;
  }

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive" onReady={trackPageView}>
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
        `}
      </Script>
    </>
  );
}

export function MetaPixelEvent({
  event,
  params,
}: {
  event: string;
  params?: Record<string, string | number>;
}) {
  useEffect(() => {
    if (!pixelId || !hasMarketingConsent() || !window.fbq) {
      return;
    }

    window.fbq("track", event, params || {});
  }, [event, params]);

  return null;
}

"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

export function MetaPixel() {
  const path=usePathname();
  const privatePage=/^\/(admin|collab|auth)(\/|$)/.test(path);
  useEffect(() => {
    if (!pixelId || privatePage) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href^='/cart'], a[href*='/cart?']");

      if (link && window.fbq) {
        window.fbq("track", "AddToCart");
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [privatePage]);

  if (!pixelId || privatePage) {
    return null;
  }

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
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
          fbq('track', 'PageView');
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
    if (!pixelId || !window.fbq) {
      return;
    }

    window.fbq("track", event, params || {});
  }, [event, params]);

  return null;
}

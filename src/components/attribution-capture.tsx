"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  ATTRIBUTION_COOKIE_KEY,
  ATTRIBUTION_EXPIRY_DAYS,
  ATTRIBUTION_STORAGE_KEY,
  captureAttribution,
  parseAttributionPayload,
} from "@/lib/attribution";

export function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    if(pathname.startsWith("/admin") || pathname.startsWith("/collab") || pathname.startsWith("/auth")) return;
    try {
    const current = parseAttributionPayload(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY));
    const next = captureAttribution(current, {
      url: window.location.href,
      referrer: document.referrer,
    });
    const serialized = JSON.stringify(next);

    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, serialized);
    document.cookie = `${ATTRIBUTION_COOKIE_KEY}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${
      ATTRIBUTION_EXPIRY_DAYS * 24 * 60 * 60
    }; SameSite=Lax`;
    } catch { /* Storage can be disabled; manual codes still work. */ }
  }, [pathname]);

  return null;
}

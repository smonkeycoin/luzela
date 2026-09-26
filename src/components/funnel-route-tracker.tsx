"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackCommerce } from "@/lib/analytics/client";

export function FunnelRouteTracker() {
  const path = usePathname();
  useEffect(() => {
    if (/^\/(admin|auth|collab)(\/|$)/.test(path)) return;
    if (path === "/") trackCommerce("view_home", {}, "view_home");
    if (path === "/chavolines" || new URLSearchParams(location.search).get("utm_campaign") === "luzela_x_chavolines") {
      trackCommerce("view_campaign", {}, "view_campaign");
    }
    if (path === "/" && location.hash === "#tienda") trackCommerce("view_shop", {}, "view_shop");
    const onHash = () => { if (location.hash === "#tienda") trackCommerce("view_shop", {}, "view_shop"); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [path]);
  return null;
}

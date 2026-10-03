"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackCommerce } from "@/lib/analytics/client";

export function FunnelRouteTracker() {
  const path = usePathname();
  useEffect(() => {
    if (/^\/(admin|auth|collab)(\/|$)/.test(path)) return;
    if (path === "/") trackCommerce("view_home", {}, "view_home");
    const params = new URLSearchParams(location.search);
    const campaign = params.get("utm_campaign") || (params.get("ref") === "summerdrop" ? "summer_drop" : "");
    if (path === "/chavolines" || campaign === "luzela_x_chavolines") {
      trackCommerce("view_campaign", {}, "view_campaign:luzela_x_chavolines");
    }
    if (path === "/summer-drop" || campaign === "summer_drop") {
      trackCommerce("view_campaign", { campaign: "summer_drop", ref: "summerdrop" }, "view_campaign:summer_drop");
    }
    if (path === "/" && location.hash === "#tienda") trackCommerce("view_shop", {}, "view_shop");
    const onHash = () => { if (location.hash === "#tienda") trackCommerce("view_shop", {}, "view_shop"); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [path]);
  return null;
}

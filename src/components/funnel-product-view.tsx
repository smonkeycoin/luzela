"use client";

import { useEffect, useRef } from "react";
import { trackCommerce } from "@/lib/analytics/client";

export function FunnelProductView({ productId, sku, className, summerPack, featured, children }: { productId: string; sku: string; className: string; summerPack?: string; featured?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        timer = setTimeout(() => trackCommerce("view_product", { product_id: productId, product_sku: sku }, `view_product:${sku}`), 1000);
      } else { clearTimeout(timer); }
    }, { threshold: [0, 0.5, 1] });
    observer.observe(node);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [productId, sku]);
  return <article ref={ref} className={className} data-summer-pack={summerPack} data-travel-duo={featured ? "true" : undefined}>{children}</article>;
}

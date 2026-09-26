"use client";

import { useEffect } from "react";
import { trackCommerce } from "@/lib/analytics/client";

export function FunnelCheckoutStart({ sku, productId, quantity, valueCents }: { sku: string; productId: string; quantity: number; valueCents: number }) {
  useEffect(() => { trackCommerce("begin_checkout", { product_sku: sku, product_id: productId, quantity, value_cents: valueCents }, `begin_checkout:${sku}`); }, [sku, productId, quantity, valueCents]);
  return null;
}

"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import type { CatalogProduct } from "@/lib/catalog/types";
import { trackCommerce } from "@/lib/analytics/client";

export function AddToCartButton({ product, featured = false }: { product: CatalogProduct; featured?: boolean }) {
  const available = product.variant.stock_on_hand > 0;
  const label = product.variant.sku === "LUZ-SUMMER-3X"
    ? "Comprar Summer Drop"
    : product.variant.analytics_item_id === "luzela_pack_10"
    ? "Comprar pack"
    : product.variant.analytics_item_id.startsWith("summer_")
      ? `Elegir ${product.variant.units_per_pack}X`
      : "Comprar";

  return (
    <Link
      href={available ? `/cart?variant=${product.variant.id}&quantity=1` : "/#tienda"}
      onClick={() => {
        if (available) trackCommerce("add_to_cart", { product_id: product.id, product_sku: product.variant.sku, quantity: 1, value_cents: product.variant.effective_price_cents });
      }}
      aria-disabled={!available}
      className={`focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] px-5 text-sm font-semibold transition sm:w-auto ${
        available
          ? featured
            ? "bg-[var(--teal)] text-white hover:bg-[#106963]"
            : "border border-[var(--ink)] bg-white text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white"
          : "pointer-events-none bg-zinc-300 text-zinc-600"
      }`}
    >
      <ShoppingBag size={18} aria-hidden />
      {label}
    </Link>
  );
}

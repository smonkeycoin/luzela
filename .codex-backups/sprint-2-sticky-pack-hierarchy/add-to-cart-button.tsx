import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import type { CatalogProduct } from "@/lib/catalog/types";

export function AddToCartButton({ product, featured = false }: { product: CatalogProduct; featured?: boolean }) {
  const available = product.variant.stock_on_hand > 0;
  const label = product.variant.analytics_item_id.startsWith("summer_")
    ? `Elegir ${product.variant.units_per_pack}X`
    : "Comprar";

  return (
    <Link
      href={available ? `/cart?variant=${product.variant.id}&quantity=1` : "/#tienda"}
      aria-disabled={!available}
      className={`focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] px-5 text-sm font-semibold transition sm:w-auto ${
        available
          ? featured
            ? "bg-[var(--coral)] text-white hover:bg-[#c94d37]"
            : "bg-[var(--ink)] text-white hover:bg-black"
          : "pointer-events-none bg-zinc-300 text-zinc-600"
      }`}
    >
      <ShoppingBag size={18} aria-hidden />
      {label}
    </Link>
  );
}

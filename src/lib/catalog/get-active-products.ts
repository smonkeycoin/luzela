import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";

import type { CatalogProduct } from "./types";
import { getAvailablePacks, getPrimaryBundleComponent } from "./pack";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  free_shipping: boolean;
  sort_order: number;
  product_images?: { url: string; sort_order: number }[] | null;
  product_variants?: {
    id: string;
    sku: string;
    name: string;
    price_cents: number;
    compare_at_price_cents: number | null;
    currency: string;
    bundle_components?: unknown;
    metadata?: Record<string, unknown> | null;
    inventory?: { stock_on_hand: number } | { stock_on_hand: number }[] | null;
  }[] | null;
  attributes?: Record<string, unknown> | null;
};

function getStockOnHand(
  inventory?: { stock_on_hand: number } | { stock_on_hand: number }[] | null,
) {
  const row = Array.isArray(inventory) ? inventory[0] : inventory;
  return row?.stock_on_hand ?? 0;
}

export async function getActiveProducts(): Promise<{
  products: CatalogProduct[];
  error?: string;
}> {
  const supabase = createSupabaseAdminClient() || createSupabasePublicClient();

  if (!supabase) {
    return { products: [], error: "Supabase env is not configured." };
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, description, free_shipping, sort_order, attributes, product_images(url, sort_order), product_variants(id, sku, name, price_cents, compare_at_price_cents, currency, bundle_components, metadata, inventory(stock_on_hand))",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    return { products: [], error: error.message };
  }

  const rows = (data || []) as ProductRow[];
  const componentVariantIds = rows
    .flatMap((product) => product.product_variants || [])
    .map((variant) => getPrimaryBundleComponent(variant.bundle_components)?.variant_id)
    .filter((variantId): variantId is string => Boolean(variantId));
  const { data: componentInventory } = componentVariantIds.length
    ? await supabase
        .from("inventory")
        .select("variant_id, stock_on_hand")
        .in("variant_id", componentVariantIds)
    : { data: [] };
  const physicalStockByVariantId = new Map(
    ((componentInventory || []) as { variant_id: string; stock_on_hand: number }[]).map(
      (row) => [row.variant_id, row.stock_on_hand],
    ),
  );

  const products = rows
    .map((product) => {
      const variant = product.product_variants?.[0];

      if (!variant) {
        return null;
      }

      const component = getPrimaryBundleComponent(variant.bundle_components);
      const unitsPerPack = component?.quantity || 1;
      const inventoryVariantId = component?.variant_id || variant.id;
      const physicalStockOnHand = component
        ? physicalStockByVariantId.get(component.variant_id) ?? 0
        : getStockOnHand(variant.inventory);
      const availablePacks = getAvailablePacks(physicalStockOnHand, unitsPerPack);
      const attributes = product.attributes || {};
      const metadata = variant.metadata || {};

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        free_shipping: product.free_shipping,
        sort_order: product.sort_order,
        image_url:
          product.product_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
            ?.url || null,
        variant: {
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          price_cents: variant.price_cents,
          compare_at_price_cents: variant.compare_at_price_cents,
          currency: variant.currency,
          stock_on_hand: availablePacks,
          physical_stock_on_hand: physicalStockOnHand,
          units_per_pack: unitsPerPack,
          inventory_variant_id: inventoryVariantId,
          analytics_item_id:
            String(metadata.analytics_item_id || metadata.campaign || variant.sku),
          unit_price_label:
            typeof attributes.unit_price_display === "string"
              ? attributes.unit_price_display
              : null,
          badge: typeof attributes.badge === "string" ? attributes.badge : null,
          secondary_headline:
            typeof attributes.secondary_headline === "string"
              ? attributes.secondary_headline
              : null,
        },
      } satisfies CatalogProduct;
    })
    .filter((product): product is CatalogProduct => Boolean(product));

  return { products };
}

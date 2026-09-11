import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { formatMoney } from "@/lib/money";
import { getAppSettings, getPublicStockLabel } from "@/lib/settings";

import type { CatalogProduct } from "./types";
import { canShowProductInStorefront } from "./display";
import { getAvailablePacks, getPrimaryBundleComponent } from "./pack";
import { getDiscountCents, getEffectivePriceCents, getPricePerUnitCents } from "./pricing";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  is_visible: boolean;
  deleted_at: string | null;
  free_shipping: boolean;
  sort_order: number;
  product_images?: { url: string; sort_order: number }[] | null;
  product_variants?: {
    id: string;
    sku: string;
    name: string;
    status: string;
    price_cents: number;
    compare_at_price_cents: number | null;
    offer_price_cents: number | null;
    offer_active: boolean;
    currency: string;
    bundle_components?: unknown;
    metadata?: Record<string, unknown> | null;
    inventory?:
      | { stock_on_hand: number; low_stock_threshold: number }
      | { stock_on_hand: number; low_stock_threshold: number }[]
      | null;
  }[] | null;
  attributes?: Record<string, unknown> | null;
};

function getStockOnHand(
  inventory?:
    | { stock_on_hand: number; low_stock_threshold?: number }
    | { stock_on_hand: number; low_stock_threshold?: number }[]
    | null,
) {
  const row = Array.isArray(inventory) ? inventory[0] : inventory;
  return row?.stock_on_hand ?? 0;
}

function getLowStockThreshold(
  inventory?:
    | { stock_on_hand: number; low_stock_threshold?: number }
    | { stock_on_hand: number; low_stock_threshold?: number }[]
    | null,
) {
  const row = Array.isArray(inventory) ? inventory[0] : inventory;
  return row?.low_stock_threshold;
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
      "id, slug, name, description, status, is_visible, deleted_at, free_shipping, sort_order, attributes, product_images(url, sort_order), product_variants(id, sku, name, status, price_cents, compare_at_price_cents, offer_price_cents, offer_active, currency, bundle_components, metadata, inventory(stock_on_hand, low_stock_threshold))",
    )
    .eq("status", "active")
    .eq("is_visible", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    return { products: [], error: error.message };
  }

  const [settings] = await Promise.all([getAppSettings()]);
  const rows = (data || []) as ProductRow[];
  const componentVariantIds = rows
    .flatMap((product) => product.product_variants || [])
    .map((variant) => getPrimaryBundleComponent(variant.bundle_components)?.variant_id)
    .filter((variantId): variantId is string => Boolean(variantId));
  const { data: componentInventory } = componentVariantIds.length
    ? await supabase
        .from("inventory")
        .select("variant_id, stock_on_hand, low_stock_threshold")
        .in("variant_id", componentVariantIds)
    : { data: [] };
  const physicalStockByVariantId = new Map(
    ((componentInventory || []) as { variant_id: string; stock_on_hand: number }[]).map(
      (row) => [row.variant_id, row.stock_on_hand],
    ),
  );
  const lowStockThresholdByVariantId = new Map(
    ((componentInventory || []) as { variant_id: string; low_stock_threshold: number }[]).map(
      (row) => [row.variant_id, row.low_stock_threshold],
    ),
  );

  const products = rows
    .map<CatalogProduct | null>((product) => {
      if (!canShowProductInStorefront(product)) {
        return null;
      }

      const variant = product.product_variants?.find(
        (candidate) => candidate.status === "active" && Number(candidate.price_cents) > 0,
      );

      if (!variant) {
        return null;
      }

      const component = getPrimaryBundleComponent(variant.bundle_components);
      const unitsPerPack = component?.quantity || 1;
      const inventoryVariantId = component?.variant_id || variant.id;
      const physicalStockOnHand = component
        ? physicalStockByVariantId.get(component.variant_id) ?? 0
        : getStockOnHand(variant.inventory);
      const lowStockThreshold = component
        ? lowStockThresholdByVariantId.get(component.variant_id)
        : getLowStockThreshold(variant.inventory);
      const availablePacks = getAvailablePacks(physicalStockOnHand, unitsPerPack);
      const effectivePriceCents = getEffectivePriceCents(variant);
      const attributes = product.attributes || {};
      const metadata = variant.metadata || {};

      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        category: typeof attributes.category === "string" ? attributes.category : null,
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
          offer_price_cents: variant.offer_price_cents,
          offer_active: variant.offer_active,
          effective_price_cents: effectivePriceCents,
          price_per_unit_cents: getPricePerUnitCents(effectivePriceCents, unitsPerPack),
          discount_cents: getDiscountCents(variant),
          currency: variant.currency,
          stock_on_hand: availablePacks,
          physical_stock_on_hand: physicalStockOnHand,
          stock_label: getPublicStockLabel({
            stock: availablePacks,
            lowStockThreshold: lowStockThreshold ?? settings.low_stock_threshold,
            showExactStockPublicly: settings.show_exact_stock_publicly,
          }),
          units_per_pack: unitsPerPack,
          inventory_variant_id: inventoryVariantId,
          analytics_item_id:
            String(metadata.analytics_item_id || metadata.campaign || variant.sku),
          unit_price_label: `${formatMoney(getPricePerUnitCents(effectivePriceCents, unitsPerPack), variant.currency)} c/u`,
          badge: typeof attributes.badge === "string" ? attributes.badge : null,
          secondary_headline:
            metadata.campaign === "summer" && unitsPerPack === 3
              ? `${unitsPerPack} Luzelas por ${formatMoney(effectivePriceCents, variant.currency)}`
              : typeof attributes.secondary_headline === "string"
              ? attributes.secondary_headline
              : null,
        },
      } satisfies CatalogProduct;
    })
    .filter((product): product is CatalogProduct => product !== null);

  return { products };
}

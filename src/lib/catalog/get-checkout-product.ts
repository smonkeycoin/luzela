import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getAppSettings, getPublicStockLabel } from "@/lib/settings";

import type { CatalogProduct } from "./types";
import { canShowProductInStorefront } from "./display";
import { getAvailablePacks, getPrimaryBundleComponent } from "./pack";
import { formatMoney } from "@/lib/money";
import { getDiscountCents, getEffectivePriceCents, getPricePerUnitCents } from "./pricing";
import { applySummerDropPricing, getSummerDropAvailability, SUMMER_DROP } from "./summer-drop";

type VariantRow = {
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
  products:
    | {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        is_visible: boolean;
        free_shipping: boolean;
        sort_order: number;
        attributes?: Record<string, unknown> | null;
        status: string;
        deleted_at: string | null;
        product_images?: { url: string; sort_order: number }[] | null;
      }
    | {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        is_visible: boolean;
        free_shipping: boolean;
        sort_order: number;
        attributes?: Record<string, unknown> | null;
        status: string;
        deleted_at: string | null;
        product_images?: { url: string; sort_order: number }[] | null;
      }[]
    | null;
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

export async function getCheckoutProduct(variantId?: string): Promise<{
  product: CatalogProduct | null;
  error?: string;
}> {
  if (!variantId) {
    return { product: null, error: "Selecciona un producto desde el catalogo." };
  }

  const supabase = createSupabaseAdminClient() || createSupabasePublicClient();

  if (!supabase) {
    return { product: null, error: "Supabase env is not configured." };
  }

  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, sku, name, status, price_cents, compare_at_price_cents, offer_price_cents, offer_active, currency, bundle_components, metadata, inventory(stock_on_hand, low_stock_threshold), products(id, slug, name, description, is_visible, free_shipping, sort_order, attributes, status, deleted_at, product_images(url, sort_order))",
    )
    .eq("id", variantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { product: null, error: error.message };
  }

  if (!data) {
    return { product: null, error: "Producto no encontrado o inactivo." };
  }

  const row = data as VariantRow;
  const productRow = Array.isArray(row.products) ? row.products[0] : row.products;

  if (
    !productRow ||
    !canShowProductInStorefront({
      status: productRow.status,
      is_visible: productRow.is_visible,
      deleted_at: productRow.deleted_at,
      product_variants: [row],
    })
  ) {
    return { product: null, error: "Producto no encontrado o inactivo." };
  }

  const component = getPrimaryBundleComponent(row.bundle_components);
  const unitsPerPack = component?.quantity || 1;
  const inventoryVariantId = component?.variant_id || row.id;
  let physicalStockOnHand = getStockOnHand(row.inventory);

  if (component) {
    const { data: componentInventory } = await supabase
      .from("inventory")
      .select("stock_on_hand, low_stock_threshold")
      .eq("variant_id", component.variant_id)
      .maybeSingle();
    physicalStockOnHand = Number(componentInventory?.stock_on_hand || 0);
    row.inventory = componentInventory || row.inventory;
  }

  const attributes = productRow.attributes || {};
  const metadata = row.metadata || {};
  const effectivePriceCents = getEffectivePriceCents(row);
  const availablePacks = getAvailablePacks(physicalStockOnHand, unitsPerPack);
  const [settings, summerDropAvailability] = await Promise.all([
    getAppSettings(),
    getSummerDropAvailability(supabase),
  ]);
  const summerDropActive = summerDropAvailability?.active === true &&
    summerDropAvailability.remaining_packs > 0;
  const campaignLimitedPacks = summerDropActive && row.sku === SUMMER_DROP.sku
    ? Math.min(availablePacks, summerDropAvailability.remaining_packs)
    : availablePacks;

  return {
    product: applySummerDropPricing({
      id: productRow.id,
      slug: productRow.slug,
      name: productRow.name,
      description: productRow.description,
      category: typeof attributes.category === "string" ? attributes.category : null,
      free_shipping: productRow.free_shipping,
      sort_order: productRow.sort_order,
      image_url:
        productRow.product_images?.sort((a, b) => a.sort_order - b.sort_order)[0]
          ?.url || null,
      variant: {
        id: row.id,
        sku: row.sku,
        name: row.name,
        price_cents: row.price_cents,
        compare_at_price_cents: row.compare_at_price_cents,
        offer_price_cents: row.offer_price_cents,
        offer_active: row.offer_active,
        effective_price_cents: effectivePriceCents,
        price_per_unit_cents: getPricePerUnitCents(effectivePriceCents, unitsPerPack),
        discount_cents: getDiscountCents(row),
        currency: row.currency,
        stock_on_hand: campaignLimitedPacks,
        physical_stock_on_hand: physicalStockOnHand,
        stock_label: getPublicStockLabel({
          stock: campaignLimitedPacks,
          lowStockThreshold: getLowStockThreshold(row.inventory) ?? settings.low_stock_threshold,
          showExactStockPublicly: settings.show_exact_stock_publicly,
        }),
        units_per_pack: unitsPerPack,
        inventory_variant_id: inventoryVariantId,
        analytics_item_id: String(metadata.analytics_item_id || metadata.campaign || row.sku),
        unit_price_label: `${formatMoney(getPricePerUnitCents(effectivePriceCents, unitsPerPack), row.currency)} c/u`,
        badge: typeof attributes.badge === "string" ? attributes.badge : null,
        secondary_headline:
          metadata.campaign === "summer" && unitsPerPack === 3
              ? `${unitsPerPack} Luzelas por ${formatMoney(effectivePriceCents, row.currency)}`
              : typeof attributes.secondary_headline === "string"
            ? attributes.secondary_headline
            : null,
      },
    }, summerDropActive),
  };
}

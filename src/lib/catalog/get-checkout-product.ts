import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/public";

import type { CatalogProduct } from "./types";
import { getAvailablePacks, getPrimaryBundleComponent } from "./pack";

type VariantRow = {
  id: string;
  sku: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  bundle_components?: unknown;
  metadata?: Record<string, unknown> | null;
  inventory?: { stock_on_hand: number } | { stock_on_hand: number }[] | null;
  products:
    | {
        id: string;
        slug: string;
        name: string;
        description: string | null;
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
  inventory?: { stock_on_hand: number } | { stock_on_hand: number }[] | null,
) {
  const row = Array.isArray(inventory) ? inventory[0] : inventory;
  return row?.stock_on_hand ?? 0;
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
      "id, sku, name, price_cents, compare_at_price_cents, currency, bundle_components, metadata, inventory(stock_on_hand), products(id, slug, name, description, free_shipping, sort_order, attributes, status, deleted_at, product_images(url, sort_order))",
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

  if (!productRow || productRow.status !== "active" || productRow.deleted_at) {
    return { product: null, error: "Producto no encontrado o inactivo." };
  }

  const component = getPrimaryBundleComponent(row.bundle_components);
  const unitsPerPack = component?.quantity || 1;
  const inventoryVariantId = component?.variant_id || row.id;
  let physicalStockOnHand = getStockOnHand(row.inventory);

  if (component) {
    const { data: componentInventory } = await supabase
      .from("inventory")
      .select("stock_on_hand")
      .eq("variant_id", component.variant_id)
      .maybeSingle();
    physicalStockOnHand = Number(componentInventory?.stock_on_hand || 0);
  }

  const attributes = productRow.attributes || {};
  const metadata = row.metadata || {};

  return {
    product: {
      id: productRow.id,
      slug: productRow.slug,
      name: productRow.name,
      description: productRow.description,
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
        currency: row.currency,
        stock_on_hand: getAvailablePacks(physicalStockOnHand, unitsPerPack),
        physical_stock_on_hand: physicalStockOnHand,
        units_per_pack: unitsPerPack,
        inventory_variant_id: inventoryVariantId,
        analytics_item_id: String(metadata.analytics_item_id || metadata.campaign || row.sku),
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
    },
  };
}

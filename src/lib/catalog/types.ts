export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  free_shipping: boolean;
  sort_order: number;
  image_url: string | null;
  variant: {
    id: string;
    sku: string;
    name: string;
    price_cents: number;
    compare_at_price_cents: number | null;
    currency: string;
    stock_on_hand: number;
    physical_stock_on_hand: number;
    units_per_pack: number;
    inventory_variant_id: string;
    analytics_item_id: string;
    unit_price_label: string | null;
    badge: string | null;
    secondary_headline: string | null;
  };
};

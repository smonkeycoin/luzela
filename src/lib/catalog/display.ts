export type CatalogDisplayVariant = {
  status: string;
  price_cents: number;
  inventory?: unknown;
  bundle_components?: unknown;
};

export type CatalogDisplayProduct = {
  status: string;
  is_visible: boolean;
  deleted_at?: string | null;
  product_variants?: CatalogDisplayVariant[] | null;
};

export function hasSellableVariant(product: CatalogDisplayProduct) {
  return Boolean(
    product.product_variants?.some(
      (variant) => variant.status === "active" && Number(variant.price_cents) > 0,
    ),
  );
}

export function canShowProductInStorefront(product: CatalogDisplayProduct) {
  return (
    product.status === "active" &&
    product.is_visible &&
    !product.deleted_at &&
    hasSellableVariant(product)
  );
}

export function getInventoryStatus({
  stock,
  lowStockThreshold,
}: {
  stock: number;
  lowStockThreshold: number;
}) {
  if (stock <= 0) {
    return "out_of_stock";
  }

  if (stock <= lowStockThreshold) {
    return "low_stock";
  }

  return "available";
}

export function getInventoryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    available: "Disponible",
    low_stock: "Stock bajo",
    out_of_stock: "Agotado",
  };

  return labels[status] || status;
}

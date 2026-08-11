export type BundleComponent = {
  variant_id: string;
  sku?: string;
  quantity: number;
};

export function getPrimaryBundleComponent(value: unknown): BundleComponent | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const [component] = value as BundleComponent[];
  const quantity = Number(component.quantity || 0);

  if (!component.variant_id || !Number.isInteger(quantity) || quantity <= 0) {
    return null;
  }

  return {
    variant_id: component.variant_id,
    sku: component.sku,
    quantity,
  };
}

export function getAvailablePacks(physicalStock: number, unitsPerPack: number) {
  if (unitsPerPack <= 0) {
    return 0;
  }

  return Math.floor(Math.max(0, physicalStock) / unitsPerPack);
}

export function getPhysicalUnitsRequired(packQuantity: number, unitsPerPack: number) {
  return packQuantity * unitsPerPack;
}

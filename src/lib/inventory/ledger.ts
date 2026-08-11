export const inventoryMovementTypes = [
  "purchase",
  "sale",
  "adjustment",
  "return",
  "damage",
  "manual_correction",
] as const;

export type InventoryMovementType = (typeof inventoryMovementTypes)[number];

export function assertInventoryMovement(type: string): asserts type is InventoryMovementType {
  if (!inventoryMovementTypes.includes(type as InventoryMovementType)) {
    throw new Error(`Unsupported inventory movement: ${type}`);
  }
}

export type InventorySnapshot = {
  stockOnHand: number;
  appliedMovementKeys: Set<string>;
};

export function applySaleMovementOnce(
  snapshot: InventorySnapshot,
  quantity: number,
  idempotencyKey: string,
): InventorySnapshot {
  if (snapshot.appliedMovementKeys.has(idempotencyKey)) {
    return snapshot;
  }

  if (quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }

  if (snapshot.stockOnHand < quantity) {
    throw new Error("Insufficient stock.");
  }

  return {
    stockOnHand: snapshot.stockOnHand - quantity,
    appliedMovementKeys: new Set([
      ...Array.from(snapshot.appliedMovementKeys),
      idempotencyKey,
    ]),
  };
}

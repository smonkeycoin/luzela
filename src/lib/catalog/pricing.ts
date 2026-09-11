export type PricingInput = {
  price_cents: number;
  offer_price_cents?: number | null;
  offer_active?: boolean | null;
};

export function isOfferEnabled(pricing: PricingInput) {
  return (
    pricing.offer_active === true &&
    Number.isInteger(pricing.offer_price_cents) &&
    Number(pricing.offer_price_cents) > 0 &&
    Number(pricing.offer_price_cents) < Number(pricing.price_cents)
  );
}

export function getEffectivePriceCents(pricing: PricingInput) {
  return isOfferEnabled(pricing)
    ? Number(pricing.offer_price_cents)
    : Number(pricing.price_cents);
}

export function getPricePerUnitCents(effectivePriceCents: number, unitsPerPack: number) {
  if (!Number.isInteger(unitsPerPack) || unitsPerPack <= 0) {
    return effectivePriceCents;
  }

  return Math.round(effectivePriceCents / unitsPerPack);
}

export function getDiscountCents(pricing: PricingInput) {
  return isOfferEnabled(pricing)
    ? Number(pricing.price_cents) - Number(pricing.offer_price_cents)
    : 0;
}

// A short-lived, same-tab handoff of a code the customer explicitly applied in the cart.
// Never derive a code from a referral, URL, campaign, or catalogue data.
export const MANUAL_CART_CODE_KEY = "luzela_manual_cart_code";

export function readManualCartCode(value: string | null, variant: string, now = Date.now()) {
  if (!value) return "";
  try {
    const transfer = JSON.parse(value);
    if (
      transfer.variant !== variant ||
      typeof transfer.code !== "string" ||
      !transfer.code.trim() ||
      transfer.code.length > 64 ||
      typeof transfer.appliedAt !== "number" ||
      transfer.appliedAt > now ||
      now - transfer.appliedAt > 10 * 60 * 1000
    ) return "";
    return transfer.code;
  } catch {
    return "";
  }
}

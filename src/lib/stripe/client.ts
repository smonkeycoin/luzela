import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  stripe ??= new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
    appInfo: {
      name: "Luzela Commerce OS",
      version: "0.1.0",
    },
  });

  return stripe;
}

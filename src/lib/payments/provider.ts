export type PaymentProvider = "mercadopago" | "stripe";

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();

  if (provider === "stripe") {
    return "stripe";
  }

  return "mercadopago";
}

export function isMercadoPagoTestCredential(value: string | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith("TEST-") || value.startsWith("APP_USR-");
}

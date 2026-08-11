import { afterEach, describe, expect, it } from "vitest";

import { getPaymentProvider } from "./provider";

describe("payment provider selection", () => {
  const originalProvider = process.env.PAYMENT_PROVIDER;

  afterEach(() => {
    process.env.PAYMENT_PROVIDER = originalProvider;
  });

  it("defaults Luzela checkout to Mercado Pago", () => {
    delete process.env.PAYMENT_PROVIDER;

    expect(getPaymentProvider()).toBe("mercadopago");
  });

  it("keeps Stripe available only as explicit rollback", () => {
    process.env.PAYMENT_PROVIDER = "stripe";

    expect(getPaymentProvider()).toBe("stripe");
  });
});

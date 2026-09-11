import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMercadoPagoOrder } from "./client";

const fetchMock = vi.fn();

describe("Mercado Pago Orders API client", () => {
  beforeEach(() => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "ORD01LUZELA",
        status: "processed",
        external_reference: "order-1",
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it.each(["819.00", "737.10"])("sends the final 3X amount %s with server-side idempotency", async (amount) => {
    await createMercadoPagoOrder({
      idempotencyKey: "mp-order:checkout-session-1",
      totalAmount: amount,
      externalReference: "order-1",
      payer: { email: "cliente@example.com" },
      payment: {
        amount: amount,
        paymentMethodId: "visa",
        paymentMethodType: "credit_card",
        token: "card-token",
        installments: 1,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    const body = JSON.parse(init.body) as {
      total_amount: string;
      external_reference: string;
      transactions: { payments: Array<{ amount: string }> };
    };

    expect(url).toBe("https://api.mercadopago.com/v1/orders");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Idempotency-Key"]).toBe("mp-order:checkout-session-1");
    expect(init.headers.Authorization).toBe("Bearer TEST-access-token");
    expect(body.total_amount).toBe(amount);
    expect(body.transactions.payments[0].amount).toBe(amount);
    expect(body.external_reference).toBe("order-1");
    expect(init.body).not.toContain("TEST-access-token");
  });

  it("fails closed when the access token is missing", async () => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");

    await expect(
      createMercadoPagoOrder({
        idempotencyKey: "mp-order:checkout-session-1",
        totalAmount: "459.00",
        externalReference: "order-1",
        payer: { email: "cliente@example.com" },
        payment: {
          amount: "459.00",
          paymentMethodId: "visa",
          paymentMethodType: "credit_card",
          token: "card-token",
          installments: 1,
        },
      }),
    ).rejects.toThrow("mercadopago_access_token_missing");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

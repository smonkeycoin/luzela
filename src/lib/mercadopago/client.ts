const MERCADOPAGO_API_BASE = "https://api.mercadopago.com";

export type MercadoPagoOrder = {
  id: string;
  status?: string;
  status_detail?: string;
  country_code?: string;
  external_reference?: string;
  total_amount?: string;
  transactions?: {
    payments?: Array<{
      id?: string;
      amount?: string;
      paid_amount?: string;
      status?: string;
      status_detail?: string;
      payment_method?: {
        id?: string;
        type?: string;
      };
    }>;
  };
};

export type CreateMercadoPagoOrderInput = {
  idempotencyKey: string;
  totalAmount: string;
  externalReference: string;
  payer: {
    email: string;
    identification?: unknown;
  };
  payment: {
    amount: string;
    paymentMethodId: string;
    paymentMethodType: string;
    token: string;
    installments: number;
  };
};

export function getMercadoPagoPublicKey() {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || "";
}

export function getMercadoPagoAccessToken() {
  return process.env.MERCADOPAGO_ACCESS_TOKEN || "";
}

export function getMercadoPagoWebhookSecret() {
  return process.env.MERCADOPAGO_WEBHOOK_SECRET || "";
}

export function centsToMercadoPagoAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function createMercadoPagoOrder(input: CreateMercadoPagoOrderInput) {
  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    throw new Error("mercadopago_access_token_missing");
  }

  const response = await fetch(`${MERCADOPAGO_API_BASE}/v1/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      type: "online",
      processing_mode: "automatic",
      total_amount: input.totalAmount,
      external_reference: input.externalReference,
      payer: input.payer,
      transactions: {
        payments: [
          {
            amount: input.payment.amount,
            payment_method: {
              id: input.payment.paymentMethodId,
              type: input.payment.paymentMethodType,
              token: input.payment.token,
              installments: input.payment.installments,
            },
          },
        ],
      },
    }),
  });

  const body = (await response.json().catch(() => ({}))) as MercadoPagoOrder & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(body.message || `mercadopago_order_create_failed:${response.status}`);
  }

  return body;
}

export async function getMercadoPagoOrder(providerOrderId: string) {
  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    throw new Error("mercadopago_access_token_missing");
  }

  const response = await fetch(
    `${MERCADOPAGO_API_BASE}/v1/orders/${encodeURIComponent(providerOrderId)}`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  const body = (await response.json().catch(() => ({}))) as MercadoPagoOrder & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(body.message || `mercadopago_order_fetch_failed:${response.status}`);
  }

  return body;
}

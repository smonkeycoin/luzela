import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock("@/lib/checkout/create-checkout-session", () => ({
  createCheckoutSession: mocks.createCheckoutSession,
}));

import { POST } from "./route";

function checkoutRequest() {
  const formData = new FormData();
  formData.set("address_line1", "Calle Luz 123");
  formData.set("city", "Cancun");
  formData.set("email", "client@example.com");
  formData.set("full_name", "Cliente Luz");
  formData.set("idempotency_key", "11111111-1111-4111-8111-111111111111");
  formData.set("phone", "5555555555");
  formData.set("postal_code", "77500");
  formData.set("product_variant_id", "22222222-2222-4222-8222-222222222222");
  formData.set("quantity", "1");
  formData.set("state", "Quintana Roo");

  return new Request("http://localhost:3001/api/checkout", {
    method: "POST",
    body: formData,
  });
}

describe("/api/checkout", () => {
  it("does not expose SQL constraint details for internal checkout failures", async () => {
    mocks.createCheckoutSession.mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: "payment_create_failed",
      detail:
        'duplicate key value violates unique constraint "payments_idempotency_key_key"',
    });

    const response = await POST(checkoutRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: "payment_temporarily_unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("payments_idempotency_key_key");
  });
});

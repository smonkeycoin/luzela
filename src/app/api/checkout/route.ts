import { NextResponse } from "next/server";
import { z } from "zod";

import { createCheckoutSession } from "@/lib/checkout/create-checkout-session";

const checkoutRequestSchema = z.object({
  email: z.email(),
  phone: z.string().min(7),
  full_name: z.string().trim().min(2),
  address_line1: z.string().trim().min(5),
  neighborhood: z.string().trim().optional(),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  postal_code: z.string().trim().min(4),
  country: z.string().trim().length(2).default("MX"),
  product_variant_id: z.uuid(),
  quantity: z.coerce.number().int().positive().max(10).default(1),
  coupon_code: z.string().trim().max(64).optional(),
  idempotency_key: z.uuid(),
  attribution: z.string().trim().max(8000).optional(),
});

export async function POST(request: Request) {
  const formData = await request.formData();
  const values = { country: "MX", ...Object.fromEntries(formData) };
  const parsed = checkoutRequestSchema.safeParse(values);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_checkout_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createCheckoutSession(parsed.data);

  if (!result.ok) {
    if (result.status >= 500) {
      console.error("Checkout failed", {
        error: result.error,
        status: result.status,
      });

      return NextResponse.json(
        { ok: false, error: "payment_temporarily_unavailable" },
        { status: result.status },
      );
    }

    return NextResponse.json(result, { status: result.status });
  }

  if(request.headers.get("accept")?.includes("application/json"))return NextResponse.json(result);
  return NextResponse.redirect(result.url, { status: 303 });
}

import { z } from "zod";
import { getCheckoutProduct } from "@/lib/catalog/get-checkout-product";
import { quotePromo } from "@/lib/collabs/quote";
const schema = z.object({
  code: z.string().trim().min(1).max(64),
  variant: z.uuid(),
  quantity: z.number().int().min(1).max(10),
});
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Revisa el código y la cantidad." },
      { status: 400 },
    );
  const { product } = await getCheckoutProduct(parsed.data.variant);
  if (!product)
    return Response.json({ error: "Producto no disponible." }, { status: 404 });
  const result = await quotePromo(
    parsed.data.code,
    product,
    parsed.data.quantity,
  );
  if (!result.ok)
    return Response.json(
      { error: result.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    {
      code: result.promo.code,
      discountCents: result.discountCents,
      percent: Number(result.promo.percent_off),
      subtotalCents:
        product.variant.effective_price_cents * parsed.data.quantity,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CatalogProduct } from "@/lib/catalog/types";
import { discountAmount, validatePromo, type Promo } from "./promo";
export async function quotePromo(
  code: string,
  product: CatalogProduct,
  quantity: number,
  email?: string,
) {
  const db = createSupabaseAdminClient();
  if (!db)
    return {
      ok: false as const,
      error: "No pudimos validar el código. Inténtalo de nuevo.",
    };
  const { data, error } = await db
    .from("coupons")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      error: "No pudimos validar el código. Inténtalo de nuevo.",
    };
  const promo = data as Promo | null;
  const invalid = validatePromo(promo, product, quantity);
  if (invalid || !promo)
    return { ok: false as const, error: invalid || "Código no disponible." };
  const { data: collab, error: collabError } = await db
    .from("collaborators")
    .select("id,slug,campaign_code,brand_name,display_name")
    .eq("id", promo.collaborator_id)
    .eq("status", "active")
    .maybeSingle();
  if (collabError || !collab)
    return { ok: false as const, error: "Esta colaboración no está activa." };
  if (
    promo.allowed_customer_emails.length &&
    (!email || !promo.allowed_customer_emails.includes(email.toLowerCase()))
  )
    return {
      ok: false as const,
      error: "Este código requiere una cuenta autorizada.",
    };
  if (promo.max_redemptions !== null) {
    const { count, error } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", promo.id);
    if (error || (count || 0) >= promo.max_redemptions)
      return {
        ok: false as const,
        error: "Este código alcanzó su límite de uso.",
      };
  }
  if (promo.per_customer_limit !== null && email) {
    const { data: customer, error: customerError } = await db
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (customerError)
      return { ok: false as const, error: "No pudimos validar el código." };
    if (customer) {
      const { count, error } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", promo.id)
        .eq("customer_id", customer.id);
      if (error || (count || 0) >= promo.per_customer_limit)
        return {
          ok: false as const,
          error: "Alcanzaste el límite de uso de este código.",
        };
    }
  }
  return {
    ok: true as const,
    promo,
    collab,
    discountCents: discountAmount(
      product.variant.effective_price_cents * quantity,
      Number(promo.percent_off),
    ),
  };
}

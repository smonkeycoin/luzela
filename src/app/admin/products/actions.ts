"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/admin";
import { assertValidOfferPricing, parsePriceCents } from "@/lib/admin/operations";
import { getPrimaryBundleComponent } from "@/lib/catalog/pack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function updateVariantPrice(variantId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect("/admin/products?result=error&reason=backend");
  }

  if (adminSession.admin.role === "readonly") {
    redirect("/admin/products?result=error&reason=role");
  }

  if (formData.get("confirm") !== "yes") {
    redirect("/admin/products?result=error&reason=confirm");
  }

  let newPriceCents = 0;
  let offerPriceCents: number | null = null;
  const offerActive = formData.get("offer_active") === "yes";

  try {
    newPriceCents = parsePriceCents(formData.get("original_price"));
    const rawOfferPrice = String(formData.get("offer_price") || "").trim();

    if (rawOfferPrice) {
      offerPriceCents = parsePriceCents(formData.get("offer_price"));
    }
  } catch {
    redirect("/admin/products?result=error&reason=price");
  }

  try {
    assertValidOfferPricing({
      originalPriceCents: newPriceCents,
      offerPriceCents,
      offerActive,
    });
  } catch {
    redirect("/admin/products?result=error&reason=offer");
  }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, product_id, price_cents, offer_price_cents, offer_active, name, sku")
    .eq("id", variantId)
    .maybeSingle();

  if (variantError || !variant) {
    redirect("/admin/products?result=error&reason=variant");
  }

  if (
    Number(variant.price_cents) === newPriceCents &&
    Number(variant.offer_price_cents || 0) === Number(offerPriceCents || 0) &&
    Boolean(variant.offer_active) === offerActive
  ) {
    redirect("/admin/products?result=unchanged");
  }

  const beforeData = {
    id: variant.id,
    product_id: variant.product_id,
    sku: variant.sku,
    price_cents: variant.price_cents,
    offer_price_cents: variant.offer_price_cents,
    offer_active: variant.offer_active,
  };
  const afterData = {
    ...beforeData,
    price_cents: newPriceCents,
    offer_price_cents: offerPriceCents,
    offer_active: offerActive,
  };

  const { error: updateError } = await supabase
    .from("product_variants")
    .update({
      price_cents: newPriceCents,
      offer_price_cents: offerPriceCents,
      offer_active: offerActive,
    })
    .eq("id", variantId);

  if (updateError) {
    redirect("/admin/products?result=error&reason=save");
  }

  await supabase.from("audit_log").insert({
    actor_user_id: adminSession.user.id,
    action: "product_price_changed",
    table_name: "product_variants",
    row_id: variantId,
    before_data: beforeData,
    after_data: {
      ...afterData,
      old_price_cents: variant.price_cents,
      new_price_cents: newPriceCents,
      actor_email: adminSession.admin.email,
    },
  });

  const auditEvents = [];

  if (Number(variant.offer_price_cents || 0) !== Number(offerPriceCents || 0)) {
    auditEvents.push({
      actor_user_id: adminSession.user.id,
      action: "product_offer_price_changed",
      table_name: "product_variants",
      row_id: variantId,
      before_data: { offer_price_cents: variant.offer_price_cents },
      after_data: {
        offer_price_cents: offerPriceCents,
        actor_email: adminSession.admin.email,
      },
    });
  }

  if (Boolean(variant.offer_active) !== offerActive) {
    auditEvents.push({
      actor_user_id: adminSession.user.id,
      action: offerActive ? "product_offer_enabled" : "product_offer_disabled",
      table_name: "product_variants",
      row_id: variantId,
      before_data: { offer_active: variant.offer_active },
      after_data: {
        offer_active: offerActive,
        actor_email: adminSession.admin.email,
      },
    });
  }

  if (auditEvents.length > 0) {
    await supabase.from("audit_log").insert(auditEvents);
  }

  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/admin/products");
  redirect("/admin/products?result=price_saved");
}

export async function updateVariantStatus(variantId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect("/admin/products?result=error&reason=backend");
  }

  if (adminSession.admin.role === "readonly") {
    redirect("/admin/products?result=error&reason=role");
  }

  if (formData.get("confirm") !== "yes") {
    redirect("/admin/products?result=error&reason=confirm");
  }

  const nextStatus = String(formData.get("status") || "");

  if (nextStatus !== "active" && nextStatus !== "inactive") {
    redirect("/admin/products?result=error&reason=status");
  }

  const { data: variant, error: variantError } = await supabase
    .from("product_variants")
    .select("id, product_id, status, name, sku")
    .eq("id", variantId)
    .maybeSingle();

  if (variantError || !variant) {
    redirect("/admin/products?result=error&reason=variant");
  }

  if (variant.status === nextStatus) {
    redirect("/admin/products?result=unchanged");
  }

  const { error: updateError } = await supabase
    .from("product_variants")
    .update({ status: nextStatus })
    .eq("id", variantId);

  if (updateError) {
    redirect("/admin/products?result=error&reason=save");
  }

  await supabase.from("audit_log").insert({
    actor_user_id: adminSession.user.id,
    action: "product_status_changed",
    table_name: "product_variants",
    row_id: variantId,
    before_data: {
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      status: variant.status,
    },
    after_data: {
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      status: nextStatus,
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/admin/products");
  redirect("/admin/products?result=status_saved");
}

export async function updateProductVisibility(productId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect("/admin/products?result=error&reason=backend");
  }

  if (adminSession.admin.role === "readonly") {
    redirect("/admin/products?result=error&reason=role");
  }

  const nextVisible = formData.get("is_visible") === "yes";
  const returnTo = String(formData.get("return_to") || "/admin/products");
  const redirectBase = returnTo.startsWith("/admin/inventory") ? "/admin/inventory" : "/admin/products";

  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "id, name, status, is_visible, product_variants(id, sku, status, price_cents, bundle_components, inventory(variant_id))",
    )
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    redirect(`${redirectBase}?result=error&reason=product`);
  }

  if (nextVisible) {
    const sellableVariant = (product.product_variants || []).find((variant) => {
      const component = getPrimaryBundleComponent(variant.bundle_components);
      const inventoryRows = Array.isArray(variant.inventory) ? variant.inventory : [];

      return (
        variant.status === "active" &&
        Number(variant.price_cents) > 0 &&
        (inventoryRows.length > 0 || Boolean(component?.variant_id))
      );
    });

    if (product.status !== "active" || !sellableVariant) {
      redirect(`${redirectBase}?result=error&reason=visibility_invalid`);
    }
  }

  if (Boolean(product.is_visible) === nextVisible) {
    redirect(`${redirectBase}?result=unchanged`);
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ is_visible: nextVisible })
    .eq("id", productId);

  if (updateError) {
    redirect(`${redirectBase}?result=error&reason=save`);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: adminSession.user.id,
    action: nextVisible ? "product_visibility_enabled" : "product_visibility_disabled",
    table_name: "products",
    row_id: productId,
    before_data: {
      is_visible: product.is_visible,
    },
    after_data: {
      is_visible: nextVisible,
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  redirect(`${redirectBase}?result=${nextVisible ? "visibility_enabled" : "visibility_disabled"}`);
}

export async function updateInventoryThreshold(variantId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect("/admin/inventory?result=error&reason=backend");
  }

  if (adminSession.admin.role === "readonly") {
    redirect("/admin/inventory?result=error&reason=role");
  }

  const threshold = Number(formData.get("low_stock_threshold"));

  if (!Number.isInteger(threshold) || threshold < 0) {
    redirect("/admin/inventory?result=error&reason=threshold");
  }

  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory")
    .select("variant_id, low_stock_threshold")
    .eq("variant_id", variantId)
    .maybeSingle();

  if (inventoryError || !inventory) {
    redirect("/admin/inventory?result=error&reason=inventory");
  }

  if (Number(inventory.low_stock_threshold) === threshold) {
    redirect("/admin/inventory?result=unchanged");
  }

  const { error: updateError } = await supabase
    .from("inventory")
    .update({ low_stock_threshold: threshold })
    .eq("variant_id", variantId);

  if (updateError) {
    redirect("/admin/inventory?result=error&reason=threshold_save");
  }

  await supabase.from("audit_log").insert({
    actor_user_id: adminSession.user.id,
    action: "stock_threshold_changed",
    table_name: "inventory",
    row_id: variantId,
    before_data: {
      low_stock_threshold: inventory.low_stock_threshold,
    },
    after_data: {
      low_stock_threshold: threshold,
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?result=threshold_saved");
}

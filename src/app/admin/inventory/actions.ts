"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  assertInventoryWillNotGoNegative,
  mapManualMovementType,
  normalizeInventoryDelta,
} from "@/lib/admin/operations";
import { requireAdminSession } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function createInventoryAdjustment(variantId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect("/admin/inventory?result=error&reason=backend");
  }

  if (adminSession.admin.role === "readonly") {
    redirect("/admin/inventory?result=error&reason=role");
  }

  if (formData.get("confirm") !== "yes") {
    redirect("/admin/inventory?result=error&reason=confirm");
  }

  const publicType = String(formData.get("movement_type") || "");
  const note = String(formData.get("note") || "").trim();
  const reference = String(formData.get("reference") || "").trim();
  const quantity = Number(formData.get("quantity"));

  if (!note) {
    redirect("/admin/inventory?result=error&reason=note");
  }

  let movementType = "";
  let quantityDelta = 0;

  try {
    movementType = mapManualMovementType(publicType);
    quantityDelta = normalizeInventoryDelta(publicType, quantity);
  } catch {
    redirect("/admin/inventory?result=error&reason=movement");
  }

  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory")
    .select("variant_id, stock_on_hand")
    .eq("variant_id", variantId)
    .maybeSingle();

  if (inventoryError || !inventory) {
    redirect("/admin/inventory?result=error&reason=inventory");
  }

  try {
    assertInventoryWillNotGoNegative(Number(inventory.stock_on_hand), quantityDelta);
  } catch {
    redirect("/admin/inventory?result=error&reason=negative");
  }

  const afterStock = Number(inventory.stock_on_hand) + quantityDelta;
  const idempotencyKey = `admin:${adminSession.user.id}:${variantId}:${Date.now()}`;
  const movementMetadata = {
    admin_public_type: publicType,
    reference: reference || null,
    stock_before: inventory.stock_on_hand,
    stock_after: afterStock,
    actor_email: adminSession.admin.email,
  };

  const { data: movement, error: movementError } = await supabase
    .from("inventory_movements")
    .insert({
      variant_id: variantId,
      movement_type: movementType,
      quantity_delta: quantityDelta,
      reason: note,
      idempotency_key: idempotencyKey,
      metadata: movementMetadata,
      created_by: adminSession.user.id,
    })
    .select("id")
    .single();

  if (movementError || !movement) {
    redirect("/admin/inventory?result=error&reason=movement_save");
  }

  const { error: stockError } = await supabase
    .from("inventory")
    .update({ stock_on_hand: afterStock })
    .eq("variant_id", variantId);

  if (stockError) {
    redirect("/admin/inventory?result=error&reason=stock_save");
  }

  await supabase.from("audit_log").insert({
    actor_user_id: adminSession.user.id,
    action: "inventory_manual_movement_created",
    table_name: "inventory_movements",
    row_id: movement.id,
    before_data: {
      variant_id: variantId,
      stock_on_hand: inventory.stock_on_hand,
    },
    after_data: {
      variant_id: variantId,
      stock_on_hand: afterStock,
      movement_type: movementType,
      quantity_delta: quantityDelta,
      reason: note,
      reference: reference || null,
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/admin/inventory");
  redirect("/admin/inventory?result=movement_saved");
}

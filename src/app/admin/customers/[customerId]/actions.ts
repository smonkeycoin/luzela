"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/admin";
import { getFeatureFlags } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function saveCustomerNote(customerId: string, formData: FormData) {
  const adminSession = await requireAdminSession();
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    redirect(`/admin/customers/${customerId}?note=error&reason=backend`);
  }

  if (adminSession.admin.role !== "owner" && adminSession.admin.role !== "admin") {
    redirect(`/admin/customers/${customerId}?note=error&reason=role`);
  }

  const featureFlags = await getFeatureFlags();

  if (!featureFlags.customerNotesEnabled) {
    redirect(`/admin/customers/${customerId}?note=error&reason=disabled`);
  }

  const note = String(formData.get("note") || "").trim();

  if (!note || note.length > 1000) {
    redirect(`/admin/customers/${customerId}?note=error&reason=note`);
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (customerError || !customer) {
    redirect(`/admin/customers/${customerId}?note=error&reason=customer`);
  }

  const { error } = await supabase.from("customer_notes").insert({
    customer_id: customerId,
    author_id: adminSession.user.id,
    note,
  });

  if (error) {
    redirect(`/admin/customers/${customerId}?note=error&reason=save`);
  }

  await supabase.from("audit_log").insert({
    actor_user_id: adminSession.user.id,
    action: "customer_note_updated",
    table_name: "customer_notes",
    row_id: customerId,
    after_data: {
      customer_id: customerId,
      actor_email: adminSession.admin.email,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${customerId}?note=saved`);
}

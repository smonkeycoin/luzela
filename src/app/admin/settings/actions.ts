"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/admin";
import { type AppSettings, updateAppSettings } from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SettingsSection =
  | "general"
  | "inventory"
  | "shipping"
  | "email"
  | "features";

export async function saveSettingsSection(section: SettingsSection, formData: FormData) {
  const adminSession = await requireAdminSession();

  if (adminSession.admin.role !== "owner" && adminSession.admin.role !== "admin") {
    redirect(`/admin/settings?section=${section}&settings=error&reason=role`);
  }

  let values: Partial<AppSettings>;

  try {
    values = getSectionValues(section, formData);
    const result = await updateAppSettings(values);
    await auditSettingsChanges({
      section,
      actorUserId: adminSession.user.id,
      actorEmail: adminSession.admin.email,
      current: result.current,
      next: result.next,
      changed: result.changed,
    });
  } catch {
    redirect(`/admin/settings?section=${section}&settings=error&reason=validation`);
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/customers");
  revalidatePath("/shipping");
  revalidatePath("/faq");
  revalidatePath("/");
  redirect(`/admin/settings?section=${section}&settings=saved`);
}

function getSectionValues(section: SettingsSection, formData: FormData): Partial<AppSettings> {
  if (section === "general") {
    return {
      store_name: stringValue(formData, "store_name"),
      default_country: stringValue(formData, "default_country"),
      timezone: stringValue(formData, "timezone") as AppSettings["timezone"],
      locale: stringValue(formData, "locale") as AppSettings["locale"],
      currency_code: "MXN",
    };
  }

  if (section === "inventory") {
    return {
      low_stock_threshold: numberValue(formData, "low_stock_threshold"),
      critical_stock_threshold: numberValue(formData, "critical_stock_threshold"),
      show_exact_stock_publicly: booleanValue(formData, "show_exact_stock_publicly"),
    };
  }

  if (section === "shipping") {
    const freeShipping = booleanValue(formData, "free_shipping_enabled");

    return {
      default_carrier: stringValue(formData, "default_carrier"),
      carrier_display_name: stringValue(formData, "carrier_display_name"),
      shipping_min_days: numberValue(formData, "shipping_min_days"),
      shipping_max_days: numberValue(formData, "shipping_max_days"),
      shipping_business_days: booleanValue(formData, "shipping_business_days"),
      free_shipping_enabled: freeShipping,
      shipping_fee_cents: freeShipping ? 0 : moneyValue(formData, "shipping_fee"),
      shipping_policy_short: stringValue(formData, "shipping_policy_short"),
    };
  }

  if (section === "email") {
    return {
      transactional_emails_enabled: booleanValue(formData, "transactional_emails_enabled"),
      order_confirmation_email_enabled: booleanValue(
        formData,
        "order_confirmation_email_enabled",
      ),
      shipping_confirmation_email_enabled: booleanValue(
        formData,
        "shipping_confirmation_email_enabled",
      ),
      resend_from_name: stringValue(formData, "resend_from_name"),
      resend_from_email: stringValue(formData, "resend_from_email"),
      reply_to_email: stringValue(formData, "reply_to_email", false),
    };
  }

  return {
    customer_notes_enabled: booleanValue(formData, "customer_notes_enabled"),
    analytics_enabled: booleanValue(formData, "analytics_enabled"),
    public_reviews_enabled: booleanValue(formData, "public_reviews_enabled"),
    show_exact_stock_publicly: booleanValue(formData, "show_exact_stock_publicly"),
    transactional_emails_enabled: booleanValue(formData, "transactional_emails_enabled"),
    shipping_confirmation_email_enabled: booleanValue(
      formData,
      "shipping_confirmation_email_enabled",
    ),
  };
}

async function auditSettingsChanges({
  section,
  actorUserId,
  actorEmail,
  current,
  next,
  changed,
}: {
  section: SettingsSection;
  actorUserId: string;
  actorEmail: string;
  current: AppSettings;
  next: AppSettings;
  changed: Array<keyof AppSettings>;
}) {
  if (changed.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();

  await supabase?.from("audit_log").insert(
    changed.map((field) => ({
      actor_user_id: actorUserId,
      action: getAuditAction(field, Boolean(current[field]), Boolean(next[field])),
      table_name: "app_settings",
      row_id: null,
      before_data: {
        section,
        field,
        value: current[field],
      },
      after_data: {
        section,
        field,
        value: next[field],
        actor_email: actorEmail,
      },
    })),
  );
}

function getAuditAction(field: keyof AppSettings, before: boolean, after: boolean) {
  if (String(field).endsWith("_enabled") || field === "show_exact_stock_publicly") {
    return after && !before ? "feature_flag_enabled" : !after && before ? "feature_flag_disabled" : "settings_updated";
  }

  return "settings_updated";
}

function stringValue(formData: FormData, key: string, required = true) {
  const value = String(formData.get(key) || "").trim();

  if (required && !value) {
    throw new Error("required");
  }

  return value;
}

function numberValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value)) {
    throw new Error("number_required");
  }

  return Math.round(value);
}

function moneyValue(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value)) {
    throw new Error("money_required");
  }

  return Math.round(value * 100);
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

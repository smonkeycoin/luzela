import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getInventoryStatus, getInventoryStatusLabel } from "@/lib/catalog/display";

export const APP_SETTINGS_DEFAULTS = {
  store_name: "Luzela",
  default_country: "México",
  timezone: "America/Mexico_City",
  locale: "es-MX",
  currency_code: "MXN",
  low_stock_threshold: 20,
  critical_stock_threshold: 10,
  show_exact_stock_publicly: false,
  default_carrier: "DHL",
  carrier_display_name: "DHL Express",
  shipping_min_days: 2,
  shipping_max_days: 5,
  shipping_business_days: true,
  prepare_attention_hours: 24,
  shipping_attention_hours: 48,
  free_shipping_enabled: true,
  shipping_fee_cents: 0,
  shipping_policy_short:
    "Envío incluido a todo México. Entrega estimada de 2 a 5 días hábiles mediante DHL Express.",
  transactional_emails_enabled: true,
  order_confirmation_email_enabled: true,
  shipping_confirmation_email_enabled: true,
  resend_from_name: "Luzela",
  resend_from_email: "orders@luzela.mx",
  reply_to_email: "",
  customer_notes_enabled: true,
  analytics_enabled: true,
  public_reviews_enabled: true,
};

export type AppSettings = typeof APP_SETTINGS_DEFAULTS;
export type AppSettingKey = keyof AppSettings;

export type PublicSettings = Pick<
  AppSettings,
  | "store_name"
  | "currency_code"
  | "default_country"
  | "locale"
  | "timezone"
  | "carrier_display_name"
  | "shipping_min_days"
  | "shipping_max_days"
  | "shipping_business_days"
  | "prepare_attention_hours"
  | "shipping_attention_hours"
  | "free_shipping_enabled"
  | "shipping_fee_cents"
  | "shipping_policy_short"
  | "show_exact_stock_publicly"
  | "public_reviews_enabled"
>;

export const appSettingsSchema = z
  .object({
    store_name: z.string().trim().min(1).max(80),
    default_country: z.string().trim().min(1).max(80),
    timezone: z.enum(["America/Mexico_City", "America/Cancun"]),
    locale: z.enum(["es-MX"]),
    currency_code: z.enum(["MXN"]),
    low_stock_threshold: z.coerce.number().int().min(0).max(100000),
    critical_stock_threshold: z.coerce.number().int().min(0).max(100000),
    show_exact_stock_publicly: z.boolean(),
    default_carrier: z.string().trim().min(1).max(40),
    carrier_display_name: z.string().trim().min(1).max(80),
    shipping_min_days: z.coerce.number().int().min(0).max(60),
    shipping_max_days: z.coerce.number().int().min(0).max(90),
    shipping_business_days: z.boolean(),
    prepare_attention_hours: z.coerce.number().int().min(1).max(720),
    shipping_attention_hours: z.coerce.number().int().min(1).max(720),
    free_shipping_enabled: z.boolean(),
    shipping_fee_cents: z.coerce.number().int().min(0).max(1000000),
    shipping_policy_short: z.string().trim().min(1).max(220),
    transactional_emails_enabled: z.boolean(),
    order_confirmation_email_enabled: z.boolean(),
    shipping_confirmation_email_enabled: z.boolean(),
    resend_from_name: z.string().trim().min(1).max(80),
    resend_from_email: z.string().trim().email().max(120),
    reply_to_email: z.union([z.literal(""), z.string().trim().email().max(120)]),
    customer_notes_enabled: z.boolean(),
    analytics_enabled: z.boolean(),
    public_reviews_enabled: z.boolean(),
  })
  .superRefine((settings, ctx) => {
    if (settings.critical_stock_threshold > settings.low_stock_threshold) {
      ctx.addIssue({
        code: "custom",
        path: ["critical_stock_threshold"],
        message: "critical_must_be_lte_low",
      });
    }

    if (settings.shipping_max_days < settings.shipping_min_days) {
      ctx.addIssue({
        code: "custom",
        path: ["shipping_max_days"],
        message: "shipping_max_must_be_gte_min",
      });
    }
  });

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { ...APP_SETTINGS_DEFAULTS };
  }

  const { data } = await supabase.from("app_settings").select("key, value");
  const values = { ...APP_SETTINGS_DEFAULTS };

  for (const row of data || []) {
    applySettingValue(values, row.key, row.value);
  }

  return appSettingsSchema.parse(values);
}

export async function updateAppSettings(values: Partial<AppSettings>) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const current = await getAppSettings();
  const next = appSettingsSchema.parse({ ...current, ...values });
  const keys = Object.keys(values) as AppSettingKey[];
  const rows = keys.map((key) => ({
    key,
    value: next[key],
    public_read: PUBLIC_SETTING_KEYS.has(key),
  }));

  if (rows.length === 0) {
    return { current, next, changed: [] as AppSettingKey[] };
  }

  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });

  if (error) {
    throw new Error(error.message);
  }

  return {
    current,
    next,
    changed: keys.filter((key) => current[key] !== next[key]),
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const settings = await getAppSettings();

  return {
    store_name: settings.store_name,
    currency_code: settings.currency_code,
    default_country: settings.default_country,
    locale: settings.locale,
    timezone: settings.timezone,
    carrier_display_name: settings.carrier_display_name,
    shipping_min_days: settings.shipping_min_days,
    shipping_max_days: settings.shipping_max_days,
    shipping_business_days: settings.shipping_business_days,
    prepare_attention_hours: settings.prepare_attention_hours,
    shipping_attention_hours: settings.shipping_attention_hours,
    free_shipping_enabled: settings.free_shipping_enabled,
    shipping_fee_cents: settings.shipping_fee_cents,
    shipping_policy_short: settings.shipping_policy_short,
    show_exact_stock_publicly: settings.show_exact_stock_publicly,
    public_reviews_enabled: settings.public_reviews_enabled,
  };
}

export async function getShippingPolicy() {
  const settings = await getAppSettings();

  return {
    carrier: settings.default_carrier,
    carrierDisplayName: settings.carrier_display_name,
    minDays: settings.shipping_min_days,
    maxDays: settings.shipping_max_days,
    businessDays: settings.shipping_business_days,
    prepareAttentionHours: settings.prepare_attention_hours,
    shippingAttentionHours: settings.shipping_attention_hours,
    freeShippingEnabled: settings.free_shipping_enabled,
    shippingFeeCents: settings.shipping_fee_cents,
    shortCopy: settings.shipping_policy_short,
    estimateCopy: `Entrega estimada de ${settings.shipping_min_days} a ${settings.shipping_max_days} ${
      settings.shipping_business_days ? "días hábiles" : "días"
    }.`,
  };
}

export async function getEmailSettings() {
  const settings = await getAppSettings();

  return {
    transactionalEmailsEnabled: settings.transactional_emails_enabled,
    orderConfirmationEnabled: settings.order_confirmation_email_enabled,
    shippingConfirmationEnabled: settings.shipping_confirmation_email_enabled,
    from: `${settings.resend_from_name} <${settings.resend_from_email}>`,
    fromName: settings.resend_from_name,
    fromEmail: settings.resend_from_email,
    replyTo: settings.reply_to_email,
  };
}

export async function getFeatureFlags() {
  const settings = await getAppSettings();

  return {
    customerNotesEnabled: settings.customer_notes_enabled,
    analyticsEnabled: settings.analytics_enabled,
    publicReviewsEnabled: settings.public_reviews_enabled,
    showExactStockPublicly: settings.show_exact_stock_publicly,
    transactionalEmailsEnabled: settings.transactional_emails_enabled,
    shippingConfirmationEmailEnabled: settings.shipping_confirmation_email_enabled,
  };
}

export function getPublicStockLabel({
  stock,
  lowStockThreshold,
  showExactStockPublicly,
}: {
  stock: number;
  lowStockThreshold: number;
  showExactStockPublicly: boolean;
}) {
  if (stock <= 0) {
    return "Agotado";
  }

  if (showExactStockPublicly) {
    return `${stock} disponibles`;
  }

  return getInventoryStatusLabel(getInventoryStatus({ stock, lowStockThreshold }));
}

const PUBLIC_SETTING_KEYS = new Set<AppSettingKey>([
  "store_name",
  "default_country",
  "timezone",
  "locale",
  "currency_code",
  "show_exact_stock_publicly",
  "carrier_display_name",
  "shipping_min_days",
  "shipping_max_days",
  "shipping_business_days",
  "free_shipping_enabled",
  "shipping_fee_cents",
  "shipping_policy_short",
  "public_reviews_enabled",
]);

function applySettingValue(target: Record<string, unknown>, key: string, value: unknown) {
  if (key === "currency" && target.currency_code === APP_SETTINGS_DEFAULTS.currency_code) {
    target.currency_code = String(value || "MXN").toUpperCase();
    return;
  }

  if (key === "shipping.flat_rate_cents" && target.shipping_fee_cents === 0) {
    target.shipping_fee_cents = Number(value || 0);
    return;
  }

  if (key === "shipping.free_shipping_enabled") {
    target.free_shipping_enabled = Boolean(value);
    return;
  }

  if (key in APP_SETTINGS_DEFAULTS) {
    target[key] = value;
  }
}

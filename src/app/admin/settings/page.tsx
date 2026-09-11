import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Circle, ShieldCheck } from "lucide-react";

import { getPaymentProvider } from "@/lib/payments/provider";
import {
  getAppSettings,
  getEmailSettings,
  getFeatureFlags,
  getShippingPolicy,
} from "@/lib/settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getResendConfigStatus } from "@/lib/email/transactional";

import { saveSettingsSection } from "./actions";
import { SettingsForm } from "./settings-form";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : {};
  const savedSection = String(query.section || "");
  const settingsState = String(query.settings || "");
  const [settings, shippingPolicy, emailSettings, featureFlags, systemStatus] =
    await Promise.all([
      getAppSettings(),
      getShippingPolicy(),
      getEmailSettings(),
      getFeatureFlags(),
      getSystemStatus(),
    ]);
  const resendConfig = getResendConfigStatus();

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Operating settings
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Configuración operativa no secreta. Los cambios viven en Supabase y se
            reflejan sin deploy.
          </p>
        </div>
        <div className="grid gap-2 text-xs font-semibold text-[var(--muted)] sm:grid-cols-2">
          <StatusPill ok={systemStatus.supabaseConnected} label="Supabase" />
          <StatusPill ok={getPaymentProvider() === "mercadopago"} label="Mercado Pago" />
          <StatusPill ok={resendConfig.apiKeyConfigured} label="Resend env" />
          <StatusPill ok label="DHL manual" />
        </div>
      </div>

      {settingsState === "saved" ? (
        <Notice tone="success">Cambios guardados en {sectionLabel(savedSection)}.</Notice>
      ) : null}
      {settingsState === "error" ? (
        <Notice tone="error">
          No se guardó la sección. Revisa permisos y validación de campos.
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="General"
          title="Identidad operacional"
          description="Datos base para idioma, país y zona horaria."
        >
          <SettingsForm action={saveSettingsSection.bind(null, "general")}>
            <Field label="Nombre de tienda">
              <input name="store_name" defaultValue={settings.store_name} required className={inputClass} />
            </Field>
            <Field label="País default">
              <input
                name="default_country"
                defaultValue={settings.default_country}
                required
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Timezone">
                <select name="timezone" defaultValue={settings.timezone} className={inputClass}>
                  <option value="America/Mexico_City">America/Mexico_City</option>
                  <option value="America/Cancun">America/Cancun</option>
                </select>
              </Field>
              <Field label="Locale">
                <select name="locale" defaultValue={settings.locale} className={inputClass}>
                  <option value="es-MX">es-MX</option>
                </select>
              </Field>
            </div>
            <SaveButton />
          </SettingsForm>
        </SectionCard>

        <SectionCard
          eyebrow="Commerce"
          title="Estado de comercio"
          description="Moneda y proveedor activo. Credenciales sensibles viven sólo en env."
        >
          <div className="grid gap-4">
            <Field label="Moneda">
              <select name="currency_code" defaultValue="MXN" disabled className={inputClass}>
                <option value="MXN">MXN</option>
              </select>
            </Field>
            <p className="text-xs leading-5 text-[var(--muted)]">
              Actualmente Luzela opera en pesos mexicanos.
            </p>
            <ReadonlyRow label="Payment provider" value={getPaymentProvider()} />
            <ReadonlyRow
              label="País default"
              value={`${settings.default_country} · ${settings.currency_code}`}
            />
            <ReadonlyRow
              label="Envío"
              value={shippingPolicy.freeShippingEnabled ? "Gratis activo" : "Tarifa configurada"}
            />
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Inventario"
          title="Umbrales y visibilidad"
          description="Controla alertas internas y etiquetas públicas de disponibilidad."
        >
          <SettingsForm
            action={saveSettingsSection.bind(null, "inventory")}
            confirmRules={[
              {
                field: "show_exact_stock_publicly",
                when: "checked",
                title: "Publicar stock exacto",
                body: "Esto mostrará cantidades exactas de inventario en la tienda pública.",
              },
            ]}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Low stock threshold">
                <input
                  name="low_stock_threshold"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={settings.low_stock_threshold}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Critical stock threshold">
                <input
                  name="critical_stock_threshold"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={settings.critical_stock_threshold}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
            <Toggle
              name="show_exact_stock_publicly"
              defaultChecked={settings.show_exact_stock_publicly}
              label="Mostrar stock exacto públicamente"
              hint="Si está apagado, la tienda usa Disponible, Pocas disponibles o Agotado."
            />
            <SaveButton />
          </SettingsForm>
        </SectionCard>

        <SectionCard
          eyebrow="Envíos"
          title="Carrier y promesa"
          description="Fuente operativa para copy público, checkout y emails de envío."
        >
          <SettingsForm
            action={saveSettingsSection.bind(null, "shipping")}
            confirmRules={[
              {
                field: "free_shipping_enabled",
                when: "unchecked",
                title: "Desactivar envío gratis",
                body: "El checkout comenzará a aplicar la tarifa configurada a productos sin envío gratis.",
              },
            ]}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Carrier interno">
                <input
                  name="default_carrier"
                  defaultValue={settings.default_carrier}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Nombre visible">
                <input
                  name="carrier_display_name"
                  defaultValue={settings.carrier_display_name}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Mín. días">
                <input
                  name="shipping_min_days"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={settings.shipping_min_days}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="Máx. días">
                <input
                  name="shipping_max_days"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={settings.shipping_max_days}
                  required
                  className={inputClass}
                />
              </Field>
              {settings.free_shipping_enabled ? (
                <div className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                  Tarifa MXN
                  <input type="hidden" name="shipping_fee" value="0" />
                  <p className="rounded-[8px] border border-[var(--line)] bg-[var(--background)] px-3 py-3 text-sm text-[var(--muted)]">
                    No editable mientras envío gratis está activo.
                  </p>
                </div>
              ) : (
                <Field label="Tarifa MXN">
                  <input
                    name="shipping_fee"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={settings.shipping_fee_cents / 100}
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
            <Toggle
              name="shipping_business_days"
              defaultChecked={settings.shipping_business_days}
              label="Usar días hábiles"
            />
            <Toggle
              name="free_shipping_enabled"
              defaultChecked={settings.free_shipping_enabled}
              label="Envío gratis activo"
            />
            <Field label="Política corta">
              <textarea
                name="shipping_policy_short"
                defaultValue={settings.shipping_policy_short}
                required
                maxLength={220}
                className={`${inputClass} min-h-24 py-3`}
              />
            </Field>
            <SaveButton />
          </SettingsForm>
        </SectionCard>

        <SectionCard
          eyebrow="Email"
          title="Transaccionales"
          description="Flags y remitente. La API key de Resend nunca se guarda en DB."
        >
          <SettingsForm
            action={saveSettingsSection.bind(null, "email")}
            confirmRules={[
              {
                field: "transactional_emails_enabled",
                when: "unchecked",
                title: "Apagar emails transaccionales",
                body: "Confirmaciones de compra y envío quedarán como skipped por feature_disabled.",
              },
            ]}
          >
            <Toggle
              name="transactional_emails_enabled"
              defaultChecked={settings.transactional_emails_enabled}
              label="Emails transaccionales activos"
            />
            <Toggle
              name="order_confirmation_email_enabled"
              defaultChecked={settings.order_confirmation_email_enabled}
              label="Confirmación de compra"
            />
            <Toggle
              name="shipping_confirmation_email_enabled"
              defaultChecked={settings.shipping_confirmation_email_enabled}
              label="Confirmación de envío"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From name">
                <input
                  name="resend_from_name"
                  defaultValue={settings.resend_from_name}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="From email">
                <input
                  name="resend_from_email"
                  type="email"
                  defaultValue={settings.resend_from_email}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Reply-to">
              <input
                name="reply_to_email"
                type="email"
                defaultValue={settings.reply_to_email}
                className={inputClass}
                placeholder="Opcional"
              />
            </Field>
            <div className="grid gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--background)] p-3 text-xs text-[var(--muted)]">
              <ReadonlyRow label="Runtime API key" value={resendConfig.apiKeyConfigured ? "configured" : "missing"} />
              <ReadonlyRow
                label="Sender activo"
                value={`${emailSettings.fromName} · ${emailSettings.fromEmail}`}
              />
              <ReadonlyRow label="Dominio luzela.mx" value={systemStatus.resendDomainStatus} />
            </div>
            <SaveButton />
          </SettingsForm>
        </SectionCard>

        <SectionCard
          eyebrow="Funciones"
          title="Feature flags"
          description="Flags de presentación y operación admin."
        >
          <SettingsForm
            action={saveSettingsSection.bind(null, "features")}
            confirmRules={[
              {
                field: "show_exact_stock_publicly",
                when: "checked",
                title: "Publicar stock exacto",
                body: "Esto hará visible la cantidad exacta de packs en storefront y carrito.",
              },
              {
                field: "transactional_emails_enabled",
                when: "unchecked",
                title: "Apagar emails transaccionales",
                body: "Los eventos de email nuevos se registrarán como skipped por configuración.",
              },
            ]}
          >
            <Toggle
              name="customer_notes_enabled"
              defaultChecked={featureFlags.customerNotesEnabled}
              label="Notas internas de clientes"
            />
            <Toggle
              name="analytics_enabled"
              defaultChecked={featureFlags.analyticsEnabled}
              label="Analytics admin"
            />
            <Toggle
              name="public_reviews_enabled"
              defaultChecked={featureFlags.publicReviewsEnabled}
              label="Reviews públicas"
              hint="Controla el bloque de reseñas del storefront."
            />
            <Toggle
              name="show_exact_stock_publicly"
              defaultChecked={featureFlags.showExactStockPublicly}
              label="Stock exacto público"
            />
            <Toggle
              name="transactional_emails_enabled"
              defaultChecked={featureFlags.transactionalEmailsEnabled}
              label="Emails transaccionales"
            />
            <Toggle
              name="shipping_confirmation_email_enabled"
              defaultChecked={featureFlags.shippingConfirmationEmailEnabled}
              label="Email de envío"
            />
            <SaveButton />
          </SettingsForm>
        </SectionCard>

        <SectionCard
          eyebrow="Sistema"
          title="Estado runtime"
          description="Lectura operativa sin secretos."
        >
          <div className="grid gap-3">
            <ReadonlyRow label="Supabase" value={systemStatus.supabaseConnected ? "connected" : "missing"} />
            <ReadonlyRow label="Mercado Pago" value={systemStatus.mercadoPagoConfigured ? "configured" : "missing"} />
            <ReadonlyRow label="Resend" value={resendConfig.apiKeyConfigured ? "configured" : "missing"} />
            <ReadonlyRow label="DHL" value="manual tracking" />
            <ReadonlyRow label="Environment" value={systemStatus.environment} />
            <ReadonlyRow label="APP_URL" value={systemStatus.appUrl} />
            <ReadonlyRow label="Last settings update" value={systemStatus.lastSettingsUpdate} />
            <ReadonlyRow label="Updated by" value={systemStatus.lastSettingsActor} />
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

async function getSystemStatus() {
  const supabase = createSupabaseAdminClient();
  const [settingsAudit, resendDomainStatus] = await Promise.all([
    getLastSettingsAudit(supabase),
    getResendDomainStatus(),
  ]);

  return {
    supabaseConnected: Boolean(supabase),
    mercadoPagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "not configured",
    lastSettingsUpdate: settingsAudit.updatedAt,
    lastSettingsActor: settingsAudit.actor,
    resendDomainStatus,
  };
}

async function getLastSettingsAudit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  if (!supabase) {
    return { updatedAt: "unavailable", actor: "unavailable" };
  }

  const { data: audit } = await supabase
    .from("audit_log")
    .select("created_at, after_data")
    .eq("table_name", "app_settings")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (audit?.created_at) {
    const afterData =
      typeof audit.after_data === "object" && audit.after_data
        ? (audit.after_data as Record<string, unknown>)
        : {};

    return {
      updatedAt: new Date(audit.created_at).toLocaleString("es-MX"),
      actor: typeof afterData.actor_email === "string" ? afterData.actor_email : "admin",
    };
  }

  const { data: setting } = await supabase
    .from("app_settings")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    updatedAt: setting?.updated_at ? new Date(setting.updated_at).toLocaleString("es-MX") : "sin cambios",
    actor: "sin audit log",
  };
}

async function getResendDomainStatus() {
  if (!process.env.RESEND_API_KEY) {
    return "missing";
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return "unavailable";
    }

    const body = (await response.json()) as {
      data?: Array<{ name?: string; status?: string }>;
    };
    const domain = body.data?.find((item) => item.name === "luzela.mx");

    return domain?.status || "not found";
  } catch {
    return "unavailable";
  }
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="surface rounded-[8px] p-5">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
      {label}
      {children}
    </label>
  );
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[8px] border border-[var(--line)] bg-white p-3">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 accent-[var(--teal)]"
      />
      <span className="grid gap-1 text-sm">
        <span className="font-semibold text-[var(--ink)]">{label}</span>
        {hint ? <span className="text-xs leading-5 text-[var(--muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function SaveButton() {
  return (
    <button
      type="submit"
      className="focus-ring inline-flex h-11 w-fit items-center justify-center rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
    >
      Guardar cambios
    </button>
  );
}

function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={`mt-5 flex items-start gap-2 rounded-[8px] border bg-white p-4 text-sm font-semibold ${
        tone === "success"
          ? "border-[#cce8d7] text-[#1f6b43]"
          : "border-[#f1d1c8] text-[#9a392b]"
      }`}
    >
      <Icon size={18} aria-hidden />
      {children}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? ShieldCheck : Circle;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-[8px] border bg-white px-3 py-2 ${
        ok ? "border-[#cce8d7] text-[#1f6b43]" : "border-[var(--line)] text-[var(--muted)]"
      }`}
    >
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}

function sectionLabel(section: string) {
  const labels: Record<string, string> = {
    general: "General",
    inventory: "Inventario",
    shipping: "Envíos",
    email: "Email",
    features: "Funciones",
  };

  return labels[section] || "Settings";
}

const inputClass =
  "focus-ring h-11 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] disabled:bg-[var(--background)] disabled:text-[var(--muted)]";

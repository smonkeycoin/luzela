import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import {
  APP_SETTINGS_DEFAULTS,
  appSettingsSchema,
  getPublicSettings,
  getPublicStockLabel,
} from "./settings";

describe("app settings", () => {
  it("accepts operational defaults", () => {
    expect(appSettingsSchema.parse(APP_SETTINGS_DEFAULTS)).toMatchObject({
      store_name: "Luzela",
      currency_code: "MXN",
      low_stock_threshold: 20,
      critical_stock_threshold: 10,
      shipping_min_days: 2,
      shipping_max_days: 5,
    });
  });

  it("rejects critical threshold above low threshold", () => {
    const result = appSettingsSchema.safeParse({
      ...APP_SETTINGS_DEFAULTS,
      low_stock_threshold: 10,
      critical_stock_threshold: 11,
    });

    expect(result.success).toBe(false);
  });

  it("rejects shipping max below min", () => {
    const result = appSettingsSchema.safeParse({
      ...APP_SETTINGS_DEFAULTS,
      shipping_min_days: 6,
      shipping_max_days: 5,
    });

    expect(result.success).toBe(false);
  });

  it("does not expose exact stock unless enabled", () => {
    expect(
      getPublicStockLabel({
        stock: 12,
        lowStockThreshold: 20,
        showExactStockPublicly: false,
      }),
    ).toBe("Stock bajo");
    expect(
      getPublicStockLabel({
        stock: 12,
        lowStockThreshold: 20,
        showExactStockPublicly: true,
      }),
    ).toBe("12 disponibles");
  });

  it("returns only the public settings whitelist", async () => {
    mocks.createSupabaseAdminClient.mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(async () => ({
          data: [
            { key: "currency_code", value: "MXN" },
            { key: "shipping_policy_short", value: "Envio incluido." },
            { key: "transactional_emails_enabled", value: false },
            { key: "MERCADOPAGO_ACCESS_TOKEN", value: "secret" },
            { key: "RESEND_API_KEY", value: "secret" },
          ],
          error: null,
        })),
      })),
    });

    const publicSettings = await getPublicSettings();

    expect(publicSettings).toMatchObject({
      currency_code: "MXN",
      shipping_policy_short: "Envio incluido.",
    });
    expect(publicSettings).not.toHaveProperty("transactional_emails_enabled");
    expect(publicSettings).not.toHaveProperty("MERCADOPAGO_ACCESS_TOKEN");
    expect(publicSettings).not.toHaveProperty("RESEND_API_KEY");
  });
});

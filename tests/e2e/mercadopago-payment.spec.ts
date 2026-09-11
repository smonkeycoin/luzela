import { expect, test } from "@playwright/test";

const checkoutSessionId = process.env.E2E_MERCADOPAGO_CHECKOUT_SESSION_ID;

test("Mercado Pago Card Payment Brick renders without submitting payment", async ({ page }) => {
  expect(
    checkoutSessionId,
    "Set E2E_MERCADOPAGO_CHECKOUT_SESSION_ID to smoke test a real Mercado Pago payment page.",
  ).toBeTruthy();

  await page.goto(`/checkout/payment?checkout_session=${checkoutSessionId}`);

  await expect(page.getByRole("heading", { name: "Pago seguro" })).toBeVisible();
  await expect(page.getByText("PAGO CON TARJETA")).toBeVisible();
  await expect(page.getByTestId("mercadopago-branding")).toBeVisible();
  await expect(page.getByText("Crédito o débito", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No necesitas una cuenta Mercado Pago para pagar con tarjeta."),
  ).toBeVisible();
  await expect(page.getByTestId("card-brand-logos")).toContainText("Visa");
  await expect(page.getByTestId("card-brand-logos")).toContainText("Mastercard");
  await expect(page.getByTestId("card-brand-logos")).toContainText("American Express");
  await expect(page.getByText("No pudimos cargar Mercado Pago")).toHaveCount(0);
  await expect(page.getByTestId("mercadopago-card-payment")).toBeVisible();
  await expect(page.getByTestId("mercadopago-loading")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByTestId("mercadopago-error")).toHaveCount(0);

  const brickHasRendered = await page.locator("#mercadopago-card-payment").evaluate((element) => {
    const skeleton = element.querySelector('[data-testid="skeleton-form"]');
    const iframes = element.querySelectorAll("iframe");

    return !skeleton && iframes.length > 0;
  });

  expect(brickHasRendered).toBe(true);
});

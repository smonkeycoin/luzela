import { expect, test } from "@playwright/test";

test("checkout route renders without visible JS errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  await page.goto("/checkout");

  await expect(page.getByRole("heading", { name: /Compra rápida/i })).toBeVisible();
  await expect(page.getByText(/Selecciona un producto desde la tienda/i)).toBeVisible();
  await expect(page.getByText("COMPRA SEGURA")).toBeVisible();
  await expect(page.getByText("Pago seguro").first()).toBeVisible();
  await expect(page.getByText("Conexión SSL").first()).toBeVisible();
  await expect(page.getByText("Pagos procesados con Stripe").first()).toBeVisible();
  await expect(page.getByText("VISA").last()).toBeVisible();
  await expect(page.getByLabel("Mastercard").last()).toBeVisible();
  await expect(page.getByText("AMEX").last()).toBeVisible();
  await expect(page.getByText("stripe").last()).toBeVisible();
  await expect(page.getByText("Tus datos bancarios no son almacenados por Luzela")).toBeVisible();

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/webhook|Supabase|Checkout Test|CHECKOUT TEST|Commerce OS|checkout shell|Webhook firmado/i);
  const unexpectedErrors = consoleErrors.filter(
    (message) =>
      !message.includes("/_next/hmr") &&
      !message.includes("Failed to load resource"),
  );
  expect(unexpectedErrors).toEqual([]);
});

test("checkout mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/checkout");

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  await expect(page.getByText("Resumen de compra")).toBeVisible();
});

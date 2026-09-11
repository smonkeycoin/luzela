import { expect, test } from "@playwright/test";

test.describe("shipping operations center", () => {
  test("renders operations views, filters, and read-only drawer", async ({ page }) => {
    await page.goto("/admin/shipping");

    await expect(page.getByRole("heading", { name: "Envíos" })).toBeVisible();
    await expect(page.getByText("Prepara, despacha y da seguimiento a cada pedido.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Por preparar", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Preparando/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Sin guía/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Problemas/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible();

    await page.getByRole("link", { name: "Acción requerida", exact: true }).click();
    await expect(page).toHaveURL(/view=attention/);
    await page.getByRole("link", { name: "Entregados", exact: true }).click();
    await expect(page).toHaveURL(/view=delivered/);

    await page.getByPlaceholder("Pedido, cliente o guía").fill("LZ");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page).toHaveURL(/q=LZ/);

    const firstOrderButton = page.locator("tbody button").filter({ hasText: /LZ-/ }).first();
    if ((await firstOrderButton.count()) === 0) {
      await expect(page.getByText("No hay pedidos en esta vista.")).toBeVisible();
      return;
    }

    await firstOrderButton.click();
    await expect(page.getByRole("heading", { name: /LZ-/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cliente" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await expect(page.getByText("Unidades físicas")).toBeVisible();
  });

  test("mobile queue cards do not create horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/shipping?view=attention");

    await expect(page.getByRole("heading", { name: "Envíos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});

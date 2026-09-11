import { expect, test } from "@playwright/test";

test("authenticated non-admin user is denied admin access", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole("heading", { name: /Iniciar sesion/i })).toBeVisible();
  await expect(page.getByText("Ventas hoy")).toHaveCount(0);
});

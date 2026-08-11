import { expect, test } from "@playwright/test";

test("login page renders Google button", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page.getByRole("heading", { name: /Iniciar sesion/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
});

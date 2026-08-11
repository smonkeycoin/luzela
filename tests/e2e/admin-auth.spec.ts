import { expect, test } from "@playwright/test";

test("admin redirects anonymous users to login", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole("heading", { name: /Iniciar sesion/i })).toBeVisible();
});

test("auth callback without code redirects to login", async ({ page }) => {
  await page.goto("/auth/callback");

  await expect(page).toHaveURL(/\/auth\/login\?error=missing_code/);
  await expect(page.getByRole("heading", { name: /Iniciar sesion/i })).toBeVisible();
});

test("access denied screen is available", async ({ page }) => {
  await page.goto("/auth/access-denied");

  await expect(page.getByRole("heading", { name: /Cuenta no autorizada/i })).toBeVisible();
});

test("logout route clears anonymous session safely", async ({ page }) => {
  await page.goto("/auth/logout");

  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole("heading", { name: /Iniciar sesion/i })).toBeVisible();
});

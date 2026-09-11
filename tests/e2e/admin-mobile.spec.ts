import { expect, test } from "@playwright/test";

test("mobile admin shell reaches operational routes without overflow", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByText("Ventas hoy")).toBeVisible();
  await page.getByRole("button", { name: "Pendientes de atención" }).click();
  await expect(page.getByText("Pendientes de atención").last()).toBeVisible();

  for (const route of [
    "/admin/orders?filter=attention",
    "/admin/customers",
    "/admin/products",
    "/admin/inventory",
    "/admin/shipping?view=preparing",
    "/admin/analytics?range=30d",
    "/admin/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText("404");

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  }
});

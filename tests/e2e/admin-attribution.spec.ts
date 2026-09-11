import { expect, test } from "@playwright/test";

test.describe("admin attribution analytics", () => {
  test("shows acquisition tables, first/last toggle, filters, and CSV export", async ({ page }) => {
    await page.goto("/admin/analytics?range=30d&touch=last");

    await expect(page.getByRole("heading", { name: "Revenue Attribution" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Last touch" })).toBeVisible();
    await expect(page.getByRole("link", { name: "First touch" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Source" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Campaign", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ad / Content" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Product by campaign" })).toBeVisible();

    await page.getByRole("link", { name: "First touch" }).click();
    await expect(page).toHaveURL(/touch=first/);

    const response = await page.request.get(
      "/admin/analytics/export?type=attribution&range=30d&touch=last",
    );
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-disposition"]).toMatch(/luzela-attribution-\d{4}-\d{2}-\d{2}\.csv/);
    const csv = await response.text();
    expect(csv.split("\n")[0]).toContain("order_number");
    expect(csv.split("\n")[0]).toContain("source");
    expect(csv.split("\n")[0]).not.toContain("email");
  });

  test("order detail includes acquisition section when an order is available", async ({ page }) => {
    await page.goto("/admin/orders");
    const firstOrder = page.locator("tbody a").first();

    if ((await firstOrder.count()) === 0) {
      await expect(page.getByText("Sin órdenes")).toBeVisible();
      return;
    }

    await firstOrder.click();
    await expect(page.getByRole("heading", { name: "ADQUISICIÓN" })).toBeVisible();
    await expect(page.getByText("Last touch")).toBeVisible();
    await expect(page.getByText("First touch")).toBeVisible();
  });
});

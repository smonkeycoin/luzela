import { expect, test } from "@playwright/test";

test.describe("admin dashboard commerce OS", () => {
  test("dashboard loads real KPI labels and operational modules", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByText("Ventas hoy")).toBeVisible();
    await expect(page.getByText("Ventas 7 días")).toBeVisible();
    await expect(page.getByText("Ticket promedio")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Órdenes recientes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pendientes de atención" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ventas por producto (7 días)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Actividad reciente" })).toBeVisible();
  });

  test("orders filters and side panel work without exact revenue assumptions", async ({ page }) => {
    await page.goto("/admin");

    await page.getByRole("button", { name: /Requieren atención/ }).click();
    await expect(page.getByRole("button", { name: /Requieren atención/ })).toHaveClass(/bg-\[#dff1ed\]/);

    const firstOrder = page.locator("tbody tr button").first();
    await expect(firstOrder).toBeVisible();

    await firstOrder.click();
    await expect(page.getByText("Orden seleccionada")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cliente" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shipping" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar orden" }).click();
    await expect(page.getByText("Orden seleccionada")).toBeHidden();
  });

  test("customer profile link and global search basic flow are reachable", async ({ page }) => {
    await page.goto("/admin/customers");

    const profileLink = page.locator("tbody a").first();
    await expect(profileLink).toBeVisible();

    await profileLink.click();
    await expect(page.getByText("Perfil de cliente")).toBeVisible();

    await page.goto("/admin");
    await page.getByPlaceholder("Buscar órdenes, clientes, productos…").fill("LZ");
    await expect(page.getByText("ORDERS").first()).toBeVisible();
  });

  test("mobile opens order detail as a full-screen drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin");

    await expect(page.getByText("Ventas hoy")).toBeVisible();
    const firstOrderCard = page.locator("button:visible").filter({ hasText: /LZ-/ }).first();
    await expect(firstOrderCard).toBeVisible();

    await firstOrderCard.click();
    await expect(page.getByText("Orden seleccionada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar orden" })).toBeVisible();
  });

  test("notification bell opens operational rows and routes to real filters", async ({ page }) => {
    await page.goto("/admin");

    await page.getByRole("button", { name: "Pendientes de atención" }).click();
    await expect(page.getByText("Pendientes de atención").last()).toBeVisible();

    const actionableRow = page
      .getByRole("link", { name: /Abrir vista filtrada/ })
      .first();

    if ((await actionableRow.count()) === 0) {
      await expect(page.getByText("Todo al día.")).toBeVisible();
      return;
    }

    await actionableRow.click();
    await expect(page).toHaveURL(/\/admin\/(orders|shipping|inventory)/);
  });

  test("orders sidebar badge and attention filter expose the same concept", async ({ page }) => {
    await page.goto("/admin");

    const ordersLink = page.getByRole("link", { name: /Órdenes/ }).first();
    await ordersLink.click();

    if (page.url().includes("filter=attention")) {
      await expect(page.getByRole("link", { name: /Requieren atención/ })).toHaveClass(/bg-\[var\(--ink\)\]/);
    } else {
      await expect(page.getByRole("link", { name: /Todas/ })).toBeVisible();
    }
  });

  test("admin sidebar routes resolve without 404 shells", async ({ page }) => {
    const routes = [
      "/admin",
      "/admin/orders",
      "/admin/customers",
      "/admin/products",
      "/admin/inventory",
      "/admin/shipping",
      "/admin/analytics",
      "/admin/settings",
      "/admin/reports",
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText("404");
    }
  });

  test("admin route crawl exercises core filters and settings without writes", async ({ page }) => {
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: /Requieren atención/ }).click();
    await expect(page).toHaveURL(/filter=attention/);
    await page.getByRole("link", { name: /Por preparar/ }).click();
    await expect(page).toHaveURL(/filter=to_prepare/);

    await page.goto("/admin/customers");
    await page.getByPlaceholder("Nombre, email o teléfono").fill("QA_PLAYWRIGHT");
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(/q=QA_PLAYWRIGHT/);

    await page.goto("/admin/products");
    await expect(page.getByRole("button", { name: "Guardar precio" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar estado" }).first()).toBeVisible();

    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Catálogo e inventario" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Mostrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Visible|Oculto/ }).first()).toBeVisible();
    await expect(page.getByText("Ajustar").first()).toBeVisible();

    await page.goto("/admin/shipping");
    await expect(page.getByRole("heading", { name: "Envíos" })).toBeVisible();
    await page.getByRole("link", { name: /Sin guía/ }).click();
    await expect(page).toHaveURL(/view=preparing/);
    await page.getByRole("link", { name: /Problemas/ }).click();
    await expect(page).toHaveURL(/view=problems/);

    await page.goto("/admin/analytics");
    await page.getByRole("link", { name: "7 días" }).click();
    await expect(page).toHaveURL(/range=7d/);

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios" }).first()).toBeVisible();
  });

  test("CSV exports return downloadable non-empty CSV files", async ({ page }) => {
    const exports = [
      "/admin/orders/export?filter=all&q=",
      "/admin/customers/export?segment=all&sort=last_order&q=",
      "/admin/analytics/export?range=30d",
    ];

    for (const href of exports) {
      const response = await page.request.get(href);

      expect(response.ok()).toBeTruthy();
      expect(response.headers()["content-type"]).toContain("text/csv");
      expect(response.headers()["content-disposition"]).toMatch(/luzela-.*-\d{4}-\d{2}-\d{2}\.csv/);
      expect((await response.text()).trim().length).toBeGreaterThan(0);
    }
  });
});

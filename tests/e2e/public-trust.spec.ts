import { expect, test } from "@playwright/test";

test("public footer and trust links are visible", async ({ page }) => {
  await page.goto("/");

  const aboutLink = page.getByRole("link", { name: "Nuestra historia" }).first();
  await expect(aboutLink).toHaveAttribute("href", "https://about.luzela.mx");
  await expect(page.getByRole("link", { name: "FAQ" }).first()).toHaveAttribute("href", "/faq");
  await expect(page.getByRole("link", { name: "Privacidad" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "Términos" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Envíos" })).toHaveAttribute("href", "/shipping");
  await expect(page.getByRole("link", { name: "Cambios y devoluciones" })).toHaveAttribute("href", "/returns");
  await expect(page.getByText("Pago seguro:")).toBeVisible();
});

test("faq and policy routes render approved public copy", async ({ page }) => {
  await page.goto("/faq");
  await expect(page.getByRole("heading", { name: "Preguntas frecuentes" })).toBeVisible();
  await expect(
    page.getByText("Sí. Luzela es un protector solar 100% mineral y no contiene filtros químicos."),
  ).toBeVisible();
  await page.getByText("¿Deja sensación grasosa?").click();
  await expect(page.getByText("sin dejar una sensación pesada o grasosa")).toBeVisible();
  await page.getByText("¿Cuánto tarda el envío?").click();
  await expect(page.getByText("Realizamos nuestros envíos con DHL")).toBeVisible();
  await page.getByText("¿Cómo rastreo mi pedido?").click();
  await expect(page.getByText("recibirás automáticamente por correo electrónico")).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacidad" })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Términos y condiciones" })).toBeVisible();
});

for (const width of [360, 390, 430]) {
  test(`public mobile routes have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of ["/", "/cart", "/checkout", "/faq"]) {
      await page.goto(route);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    }
  });
}

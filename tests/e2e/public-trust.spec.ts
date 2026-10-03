import { expect, test } from "@playwright/test";

test("public metadata is branded for Luzela", async ({ page, request }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Luzela | Protección Solar Mineral SPF 50+");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Protección solar mineral SPF 50+ hecha en México. Ligera, 100% mineral y pensada para acompañarte de la ciudad al mar.",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://luzela.mx",
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Luzela | Protección Solar Mineral SPF 50+",
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Más Luzela. Más días bajo el sol. Protección solar mineral SPF 50+ hecha en México.",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://luzela.mx",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/icon");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-icon",
  );

  // Branding metadata must be Luzela; installed observability scripts legitimately use Vercel paths.
  const head = await page.locator("head title, head meta, head link[rel='canonical']").evaluateAll(elements => elements.map(element => element.outerHTML).join(""));
  expect(head).not.toMatch(/vercel|vercel\.app/i);

  const ogImage = await request.get("/opengraph-image");
  expect(ogImage.ok()).toBe(true);
  expect(ogImage.headers()["content-type"]).toContain("image/png");

  const icon = await request.get("/icon");
  expect(icon.ok()).toBe(true);
  expect(icon.headers()["content-type"]).toContain("image/png");
});

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

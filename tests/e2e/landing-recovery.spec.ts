import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`canonical content and restrained campaign at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/?funnel_qa=1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Más Luzela. Más días bajo el sol.");
    const hero = page.locator("main > section").first();
    await expect(hero).not.toContainText("Paga 2");
    await expect(page.getByRole("region", { name: "Visto en", exact: true })).toBeVisible();
    await expect(page.getByAltText("El Mundo en Pareja", { exact: true })).toBeVisible();
    await expect(page.getByText("DEL CARIBE A TU RUTINA DIARIA")).toBeVisible();
    for (const name of ["Marcel", "Azu", "Ana K.", "Ale G."]) await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "LUZELA × CHAVOLINES", exact: true })).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("[data-chavolines-feature]")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/EL FAVORITO|Recomendado por|Summer Drop × Chavolines/i);
    await page.evaluate(() => document.fonts.ready);
    // Load offscreen images for a complete full-page artifact, as scrolling would.
    await page.locator("img").evaluateAll((images: HTMLImageElement[]) => Promise.all(images.map(image => {
      image.loading = "eager";
      return image.decode();
    })));
    await page.screenshot({ path: `docs/qa/landing-recovery/home-${width}.png`, fullPage: true });
    await page.screenshot({ path: `docs/qa/landing-recovery/hero-${width}.png` });
    const campaign = page.getByRole("region", { name: "Summer Drop", exact: true });
    await campaign.scrollIntoViewIfNeeded();
    await expect.poll(() => page.getByTestId("traveling-bottle-primary").evaluate(e => Number(getComputedStyle(e).opacity))).toBeLessThan(0.05);
    await campaign.screenshot({ path: `docs/qa/landing-recovery/module-${width}.png` });
    for (const pack of ["1x", "2x", "3x"]) {
      const card = page.locator(`[data-summer-pack="${pack}"]`);
      await expect(card).toBeVisible();
      await expect(card.getByRole("link")).toHaveCount(1);
    }
    const third = page.locator('[data-summer-pack="3x"]');
    const unit = await third.getByText("$256.33 c/u").boundingBox();
    const description = await third.getByText("Una edición limitada para compartir.", { exact: false }).boundingBox();
    expect(description!.y).toBeGreaterThanOrEqual(unit!.y + unit!.height);
    await page.locator("#tienda").screenshot({ path: `docs/qa/landing-recovery/shop-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });

  test(`Summer Drop route, Instagram attribution and checkout at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const events: Record<string, unknown>[] = [];
    await page.route("**/api/analytics", async route => {
      const payload = route.request().postDataJSON();
      if (payload) events.push(payload);
      await route.continue();
    });
    await page.goto("/summer-drop?utm_source=instagram&utm_medium=organic_social&utm_campaign=summer_drop&utm_content=story_01&funnel_qa=1");
    await expect(page).toHaveURL(/\/summer-drop\?/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paga 2.Recibe 3.");
    await expect(page.getByRole("img", { name: "Tres botellas originales Luzela SPF 50, de 50 ml cada una" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/qa/landing-recovery/summer-drop-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("link", { name: "COMPRAR SUMMER DROP", exact: true }).click();
    await expect(page).toHaveURL(/\/cart\?/);
    const cart = page.locator("aside");
    await expect(cart.getByText("$819.00", { exact: true })).toBeVisible();
    await expect(cart.getByText("−$50.00", { exact: true })).toBeVisible();
    await expect(cart.getByText("Incluido", { exact: true })).toBeVisible();
    await expect(cart.locator("dt").filter({ hasText: /^Total$/ }).locator("..").locator("dd")).toHaveText("$769.00");
    await page.getByRole("link", { name: "Continuar al checkout" }).click();
    await expect(page).toHaveURL(/\/checkout\?/);
    const summary = page.locator(width === 390 ? "details" : "aside").filter({ hasText: "Resumen" });
    if (width === 390) await page.getByText("Resumen de compra", { exact: true }).click();
    await expect(summary.locator("dt").filter({ hasText: /^Total$/ }).locator("..").locator("dd")).toHaveText("$769.00");
    await expect(summary.getByText("Incluido", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Código de descuento", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("attribution-payload")).toHaveValue(/story_01/);
    await expect.poll(() => events.some(e => e.event_name === "view_campaign" && e.campaign === "summer_drop" && e.landing_path === "/summer-drop" && e.is_qa === true)).toBe(true);
    await expect.poll(() => events.some(e => e.event_name === "begin_checkout")).toBe(true);
    await summary.screenshot({ path: `docs/qa/landing-recovery/checkout-summary-${width}.png` });
  });
}

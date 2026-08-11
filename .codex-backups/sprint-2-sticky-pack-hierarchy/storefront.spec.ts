import { expect, test } from "@playwright/test";

async function waitForTravelingBottle(page: import("@playwright/test").Page) {
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("traveling-luzela-ready"),
  );
}

test("storefront loads and shows products", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "LUZELA México", exact: true })).toBeVisible();
  await expect(page.getByText("SUMMER LUZELA", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Más Luzela/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SUMMER 1X" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SUMMER 2X" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SUMMER 3X" })).toBeVisible();
  await expect(page.getByText("$390.00")).toBeVisible();
  await expect(page.getByText("$650.00")).toBeVisible();
  await expect(page.getByText("$890.00")).toBeVisible();
  await expect(page.getByText("Ocean & Cenote Friendly")).toBeVisible();
  await expect(page.getByText("DEL CARIBE A TU RUTINA DIARIA")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuestra historia" }).first()).toHaveAttribute(
    "href",
    "https://about.luzela.mx",
  );

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/Commerce OS|webhook|ledger|Supabase|Sprint|checkout shell/i);
  expect(bodyText).not.toMatch(/\$590\.00|\$990\.00/);
});

test("cart can add a real storefront product", async ({ page }) => {
  await page.goto("/");

  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "SUMMER 3X" }) })
    .getByRole("link", { name: "Elegir 3X", exact: true })
    .first()
    .click();

  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByRole("heading", { name: "Revisa tu pedido." })).toBeVisible();
  await expect(page.getByText("SUMMER 3X").first()).toBeVisible();
  await expect(page.getByText("3 Luzelas por pack").first()).toBeVisible();
  await expect(page.locator('input[type="number"]').first()).toHaveValue("1");
  await expect(page.getByText("Subtotal").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar al checkout" })).toHaveAttribute(
    "href",
    /\/checkout\?variant=.*quantity=1/,
  );
});

test("traveling bottle has scroll-driven chapters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await waitForTravelingBottle(page);

  const layer = page.getByTestId("traveling-bottle-layer");
  const primary = page.getByTestId("traveling-bottle-primary");
  const secondary = page.getByTestId("traveling-bottle-secondary");
  const tertiary = page.getByTestId("traveling-bottle-tertiary");

  await expect(primary).toBeVisible();
  await expect(layer).toHaveCSS("pointer-events", "none");
  await expect(primary).toHaveCSS("opacity", "1");

  const heroTransform = await primary.evaluate((element) => getComputedStyle(element).transform);
  await page.evaluate(() => document.querySelector("[data-travel-products]")?.scrollIntoView());
  await page.waitForTimeout(120);
  const productTransform = await primary.evaluate((element) => getComputedStyle(element).transform);
  expect(productTransform).not.toBe(heroTransform);

  await page.evaluate(() => document.querySelector("[data-travel-duo]")?.scrollIntoView());
  await page.waitForTimeout(160);
  const duoBottleOpacity = await secondary.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).opacity),
  );
  const thirdBottleOpacity = await tertiary.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).opacity),
  );
  expect(duoBottleOpacity).toBeGreaterThan(0.5);
  expect(thirdBottleOpacity).toBeGreaterThan(0.3);

  await page.evaluate(() => document.querySelector("[data-travel-exit]")?.scrollIntoView());
  await page.waitForTimeout(160);
  const exitOpacity = await primary.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).opacity),
  );
  expect(exitOpacity).toBeLessThan(0.15);
});

test("traveling bottle respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByTestId("traveling-bottle-layer")).toBeHidden();
  await expect(page.getByAltText("Luzela SPF 50+").first()).toBeVisible();
});

for (const width of [768, 1024, 1440, 1920]) {
  test(`traveling bottle survives fast scroll at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/");
  await waitForTravelingBottle(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(80);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(80);
    await page.evaluate(() => document.querySelector("[data-travel-products]")?.scrollIntoView());
    await page.waitForTimeout(120);

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      opacity: Number.parseFloat(
        getComputedStyle(document.querySelector("[data-testid='traveling-bottle-primary']")!).opacity,
      ),
      transform: getComputedStyle(
        document.querySelector("[data-testid='traveling-bottle-primary']")!,
      ).transform,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.opacity).toBeGreaterThan(0.2);
    expect(metrics.transform).not.toBe("none");
  });
}

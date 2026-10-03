import { expect, test } from "@playwright/test";

async function waitForTravelingBottle(page: import("@playwright/test").Page) {
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("traveling-luzela-ready"),
  );
}

async function visualPackOrder(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-summer-pack]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          pack: element.dataset.summerPack,
          top: rect.top,
          left: rect.left,
        };
      })
      .sort((a, b) => (Math.abs(a.top - b.top) < 80 ? a.left - b.left : a.top - b.top))
      .map((item) => item.pack),
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
  await expect(page.getByText("$459.00", {exact:true})).toBeVisible();
  await expect(page.locator('[data-summer-pack="2x"]').getByText("$769.00", {exact:true})).toBeVisible();
  await expect(page.getByText("$819.00", {exact:true})).toBeVisible();
  await expect(page.getByText("$384.50 c/u")).toBeVisible();
  await expect(page.getByText("$256.33 c/u")).toBeVisible();
  await expect(page.getByText("Ocean & Cenote Friendly").first()).toBeVisible();
  await expect(page.getByText("DEL CARIBE A TU RUTINA DIARIA")).toBeVisible();
  await expect(page.locator('[data-pack-bottle="card-1x"]')).toHaveCount(1);
  await expect(page.locator('[data-pack-bottle="card-2x"]')).toHaveCount(2);
  await expect(page.locator('[data-pack-bottle="card-3x"]')).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Nuestra historia" }).first()).toHaveAttribute(
    "href",
    "https://about.luzela.mx",
  );

  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toMatch(/Commerce OS|webhook|ledger|Supabase|Sprint|checkout shell/i);
  expect(bodyText).not.toMatch(/\$590\.00|\$990\.00/);
});

test("summer pack hierarchy is editorial and has one CTA per card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  expect(await visualPackOrder(page)).toEqual(["1x", "2x", "3x"]);

  for (const pack of ["1x", "2x", "3x"]) {
    const card = page.locator(`[data-summer-pack="${pack}"]`);
    const unit = pack.replace("x", "X");
    await expect(card.getByRole("link", { name: pack === "3x" ? "COMPRAR SUMMER DROP" : `Elegir ${unit}`, exact: true })).toHaveCount(1);
  }

  const featuredCard = page.locator('[data-summer-pack="3x"]');
  const featuredCta = featuredCard.getByRole("link", { name: "COMPRAR SUMMER DROP", exact: true });

  await expect(featuredCard.getByText("SUMMER DROP", { exact: true })).toBeVisible();
  await expect(featuredCard.locator(".line-through")).toHaveCount(1);
  await expect(featuredCard.getByText("$819.00", {exact:true})).toBeVisible();
  await expect(featuredCta).toHaveClass(/bg-\[var\(--teal\)\]/);
});

test("summer pack order prioritizes 3X on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");

  expect(await visualPackOrder(page)).toEqual(["3x", "2x", "1x"]);

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});

test("cart can add a real storefront product", async ({ page }) => {
  await page.goto("/");

  await page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "SUMMER 3X" }) })
    .getByRole("link", { name: "COMPRAR SUMMER DROP", exact: true })
    .first()
    .click();

  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByRole("heading", { name: "Revisa tu pedido." })).toBeVisible();
  await expect(page.getByText("SUMMER DROP").first()).toBeVisible();
  await expect(page.getByText("3 Luzelas por pack").first()).toBeVisible();
  await expect(page.getByText("$819.00", {exact:true}).first()).toBeVisible();
  await expect(page.locator('[data-pack-bottle="cart-3x"]')).toHaveCount(3);
  await expect(page.locator('input[type="number"]').first()).toHaveValue("1");
  await expect(page.getByText("Subtotal").first()).toBeVisible();
  const checkoutLink = page.getByRole("link", { name: "Continuar al checkout" });
  await expect(checkoutLink).toHaveAttribute(
    "href",
    /\/checkout\?variant=.*quantity=1/,
  );
  await checkoutLink.click();
  await expect(page.getByRole("heading", { name: /Compra rápida/i })).toBeVisible();
  const visibleCheckoutBottles = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-pack-bottle="checkout-3x"]')).filter(
        (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        },
      ).length,
  );
  expect(visibleCheckoutBottles).toBe(3);
});

test("wholesale Pack 10 stays one commercial line with ten physical units", async ({ page }) => {
  await page.goto("/");

  const pack10Card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "LUZELA · Pack 10" }) });

  if ((await pack10Card.count()) === 0) {
    await expect(page.getByText("LUZELA · Pack 10")).toHaveCount(0);
    test.info().annotations.push({
      type: "note",
      description:
        "Pack 10 is hidden in the current storefront catalog; commercial-unit coverage remains in checkout unit tests.",
    });
    return;
  }

  await expect(pack10Card).toBeVisible();
  await expect(pack10Card.getByText("10 PIEZAS", { exact: true })).toBeVisible();
  await expect(pack10Card.getByText("$2,220.00", { exact: true })).toBeVisible();
  await expect(pack10Card.getByText("$222.00 c/u", { exact: true })).toBeVisible();
  await expect(pack10Card.getByText("Envío incluido", { exact: true })).toBeVisible();

  const buyPack = pack10Card.getByRole("link", { name: "Comprar pack", exact: true });
  await expect(buyPack).toHaveAttribute("href", /\/cart\?variant=.*quantity=1/);
  await buyPack.click();

  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByText("LUZELA · Pack 10").first()).toBeVisible();
  await expect(page.getByText("Incluye: 10 piezas").first()).toBeVisible();
  await expect(page.getByText("$2,220.00").first()).toBeVisible();
  await expect(page.getByText("Luzelas físicas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continuar al checkout" })).toHaveAttribute(
    "href",
    /\/checkout\?variant=.*quantity=1/,
  );

  const visibleCartBottles = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-pack-bottle="cart-10x"]')).filter(
        (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        },
      ).length,
  );
  expect(visibleCartBottles).toBe(3);

  await page.getByRole("link", { name: "Continuar al checkout" }).click();
  await expect(page.getByRole("heading", { name: /Compra rápida/i })).toBeVisible();
  const checkoutSummary = page.locator("aside").filter({ hasText: "LUZELA · Pack 10" });
  await expect(checkoutSummary.getByText("LUZELA · Pack 10")).toBeVisible();
  await expect(checkoutSummary.getByText("Cantidad: 1 pack")).toBeVisible();
  await expect(checkoutSummary.getByText("10 Luzelas físicas")).toBeVisible();
  await expect(checkoutSummary.getByText("Incluye: 10 piezas")).toBeVisible();
  await expect(checkoutSummary.getByText("$2,220.00").first()).toBeVisible();
  await expect(checkoutSummary.getByText("Incluido").first()).toBeVisible();

  const visibleCheckoutBottles = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('[data-pack-bottle="checkout-10x"]')).filter(
        (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        },
      ).length,
  );
  expect(visibleCheckoutBottles).toBe(3);
});

test("traveling bottle has scroll-driven chapters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await waitForTravelingBottle(page);

  const layer = page.getByTestId("traveling-bottle-layer");
  const primary = page.getByTestId("traveling-bottle-primary");

  await expect(primary).toBeVisible();
  await expect(layer).toHaveCSS("pointer-events", "none");
  await expect(primary).toHaveCSS("opacity", "1");

  const heroTransform = await primary.evaluate((element) => getComputedStyle(element).transform);
  await page.evaluate(() => document.querySelector("[data-travel-products]")?.scrollIntoView());
  await page.waitForTimeout(120);
  const productTransform = await primary.evaluate((element) => getComputedStyle(element).transform);
  expect(productTransform).not.toBe(heroTransform);

  const overlap = await page.evaluate(() => {
    const bottle = document.querySelector("[data-testid='traveling-bottle-primary']");
    const card = document.querySelector('[data-summer-pack="3x"]');

    if (!bottle || !card) {
      return true;
    }

    const bottleRect = bottle.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const opacity = Number.parseFloat(getComputedStyle(bottle).opacity);

    if (opacity < 0.12) {
      return false;
    }

    return !(
      bottleRect.right < cardRect.left ||
      bottleRect.left > cardRect.right ||
      bottleRect.bottom < cardRect.top ||
      bottleRect.top > cardRect.bottom
    );
  });

  expect(overlap).toBe(false);

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
    expect(metrics.opacity).toBeGreaterThanOrEqual(0);
    expect(metrics.transform).not.toBe("none");
  });
}

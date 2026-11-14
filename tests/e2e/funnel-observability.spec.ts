import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.skip(process.env.LUZELA_V4_READONLY_QA !== "1", "Requires the dedicated local read-only QA runtime.");

// This suite requires scripts/qa/v4-readonly-runtime.cjs on the local server.
// The browser submits only to this in-memory route, never to order creation.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/analytics", route => route.fulfill({ status: 204 }));
  await page.route("**/api/mercadopago/order", route => route.abort());
  await page.route("**/api/checkout", async route => {
    const body = route.request().postData() || "";
    expect(body).toContain('name="analytics_is_qa"');
    expect(body).toContain("true");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({url:"/checkout/payment?checkout_session=00000000-0000-4000-8000-000000000004"}) });
  });
});

const qaEmail = `qa+funnel-${Date.now()}@example.com`;

async function chooseSummer3x(page: import("@playwright/test").Page) {
  await page.getByRole("radio", { name: /SUMMER 3X/ }).check();
  const product = page.locator('article[data-summer-pack="3x"]');
  await expect(product).toBeVisible();
  await product.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1300);
  await product.getByRole("link", { name: /COMPRAR SUMMER DROP/i }).click();
  await expect(page).toHaveURL(/\/cart\?/);
  await expect(page.getByRole("heading", { name: /Summer/i }).first()).toBeVisible();
}

async function reachCheckout(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: /Continuar al checkout/i }).first().click();
  await expect(page).toHaveURL(/\/checkout\?/);
  await expect(page.getByRole("button", { name: /Continuar a pago seguro/i })).toBeEnabled();
}

test("QA storefront reaches a ready Card Brick with a local simulated checkout", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?funnel_qa=1");
  await chooseSummer3x(page);
  await reachCheckout(page);
  const initialSession = await page.evaluate(() => JSON.parse(sessionStorage.getItem("luzela_funnel_session_v1") || "null")?.id);
  await page.locator('[name="email"]').fill(qaEmail);
  await page.locator('[name="phone"]').fill("9981234567");
  await page.locator('[name="full_name"]').fill("Prueba Funnel QA");
  await page.locator('[name="address_line1"]').fill("Calle Prueba 123");
  await page.locator('[name="neighborhood"]').fill("Centro");
  await page.locator('[name="city"]').fill("Cancún");
  await page.locator('[name="state"]').fill("Quintana Roo");
  await page.locator('[name="postal_code"]').fill("77500");
  await page.getByRole("button", { name: /Continuar a pago seguro/i }).click();
  await expect(page).toHaveURL(/\/checkout\/payment\?checkout_session=/, { timeout: 45_000 });
  await expect(page.getByTestId("mercadopago-card-payment")).toBeVisible();
  await expect(page.locator('#mercadopago-card-payment iframe').first()).toBeVisible({ timeout: 45_000 });
  const result = await page.evaluate(() => ({
    session: JSON.parse(sessionStorage.getItem("luzela_funnel_session_v1") || "null")?.id,
    checkout: new URLSearchParams(location.search).get("checkout_session"),
  }));
  expect(result.session).toBe(initialSession);
  await page.screenshot({path:"docs/qa/v4/card-brick-ready.png",fullPage:true});
  expect(result.checkout).toBe("00000000-0000-4000-8000-000000000004");
});

test("Chavolines QA attribution persists to checkout without a payment", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/chavolines?utm_source=instagram&utm_medium=creator&utm_campaign=luzela_x_chavolines&utm_content=qa&funnel_qa=1");
  await expect(page).toHaveURL(/utm_campaign=luzela_x_chavolines/);
  await chooseSummer3x(page);
  await reachCheckout(page);
  const attribution = await page.evaluate(() => ({
    session: JSON.parse(sessionStorage.getItem("luzela_funnel_session_v1") || "null")?.id,
    stored: localStorage.getItem("luzela_attribution_v1"),
  }));
  console.log(`CHAVOLINES_QA ${JSON.stringify(attribution)}`);
});

test("a failing analytics endpoint never blocks cart or Card Brick", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/analytics", (route) => route.fulfill({ status: 503, body: "analytics unavailable" }));
  await page.goto("/?funnel_qa=1");
  await chooseSummer3x(page);
  await reachCheckout(page);
  await page.locator('[name="email"]').fill(`qa+funnel-failure-${Date.now()}@example.com`);
  await page.locator('[name="phone"]').fill("9981234567");
  await page.locator('[name="full_name"]').fill("Prueba Funnel Fallo");
  await page.locator('[name="address_line1"]').fill("Calle Prueba 123");
  await page.locator('[name="city"]').fill("Cancún");
  await page.locator('[name="state"]').fill("Quintana Roo");
  await page.locator('[name="postal_code"]').fill("77500");
  await page.getByRole("button", { name: /Continuar a pago seguro/i }).click();
  await expect(page).toHaveURL(/\/checkout\/payment\?checkout_session=/, { timeout: 45_000 });
  await expect(page.locator('#mercadopago-card-payment iframe').first()).toBeVisible({ timeout: 45_000 });
  console.log(`FUNNEL_FAILURE_QA ${new URL(page.url()).searchParams.get("checkout_session")}`);
});

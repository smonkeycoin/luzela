import { expect, test } from '@playwright/test';

test('storefront preserves all presentations and authoritative prices', async ({ page }) => {
  await page.goto('/?funnel_qa=1');
  await expect(page.getByRole('link', { name: 'LUZELA México', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('El sol es partede tu vida.');
  await expect(page.getByRole('radio')).toHaveCount(3);
  for (const [units, price, perUnit] of [[1, '$459.00', '$459.00 c/u'], [2, '$769.00', '$384.50 c/u'], [3, '$769.00', '$256.33 c/u']] as const) {
    await page.getByRole('radio', { name: `SUMMER ${units}X, ${units} piezas`, exact: true }).check();
    const selected = page.locator(`#tienda article[data-summer-pack="${units}x"]`);
    await expect(selected.getByRole('heading', { name: `SUMMER ${units}X` })).toBeVisible();
    await expect(selected.getByText(price, { exact: true })).toBeVisible();
    await expect(selected.getByText(perUnit, { exact: true })).toBeVisible();
    await expect(selected.locator('[data-bottle-count] img')).toHaveCount(units);
    await expect(selected.getByRole('link')).toHaveCount(1);
    if (units === 3) {
      await expect(selected.locator('del')).toHaveText('$819.00');
      await expect(selected.getByText('Descuento vigente: $50.00')).toBeVisible();
    }
  }
});

test('keyboard selection retains every pack and sends the selected variant to cart', async ({ page }) => {
  await page.goto('/?funnel_qa=1');
  const radio = page.getByRole('radio').first();
  await radio.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /SUMMER 2X/ })).toBeChecked();
  const product = page.locator('#tienda article');
  await expect(product.getByRole('heading')).toHaveText('SUMMER 2X');
  await product.getByRole('link').click();
  await expect(page).toHaveURL(/\/cart\?variant=5967228b-715e-4f35-b6d8-a664547124ea&quantity=1/);
  await expect(page.getByRole('heading', { name: 'Revisa tu pedido.' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar al checkout' }).click();
  await expect(page.getByRole('heading', { name: /Compra rápida/ })).toBeVisible();
  await expect(page.locator('input[name="product_variant_id"]')).toHaveValue('5967228b-715e-4f35-b6d8-a664547124ea');
});

test('selection changes do not duplicate product events or lose attribution', async ({ page }) => {
  const events: Record<string, unknown>[] = [];
  await page.route('**/api/analytics', async route => { events.push(route.request().postDataJSON()); await route.fulfill({status:204}); });
  await page.goto('/?ref=chavolines&utm_source=instagram&utm_medium=creator&utm_campaign=luzela_x_chavolines&funnel_qa=1');
  await page.locator('#tienda article').scrollIntoViewIfNeeded();
  await expect.poll(() => events.filter(e => e.event_name === 'view_product' && e.product_sku === 'LUZ-SUMMER-1X').length).toBe(1);
  await page.getByRole('radio', {name:/SUMMER 2X/}).check();
  await page.locator('#tienda article').scrollIntoViewIfNeeded();
  await expect.poll(() => events.filter(e => e.event_name === 'view_product' && e.product_sku === 'LUZ-SUMMER-2X').length).toBe(1);
  await page.getByRole('radio', {name:/SUMMER 1X/}).check();
  await page.locator('#tienda article').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200); // The production visibility dwell is 1000ms.
  expect(events.filter(e => e.event_name === 'view_product' && e.product_sku === 'LUZ-SUMMER-1X')).toHaveLength(1);
  await page.locator('#tienda article').getByRole('link').click();
  await page.getByRole('link', {name:'Continuar al checkout'}).click();
  await expect(page.getByTestId('attribution-payload')).toHaveValue(/luzela_x_chavolines/);
  expect(events.filter(e => ['view_product','add_to_cart','begin_checkout'].includes(String(e.event_name))).every(e => e.is_qa === true)).toBe(true);
});

for (const [width,height] of [[375,812],[390,844],[768,1024],[1440,900]]) {
  test(`V4 responsive, touch targets and restrained motion at ${width}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/?funnel_qa=1');
    await expect(page.getByTestId('traveling-bottle-layer')).toHaveCount(0);
    await expect(page.locator('section').first().getByRole('img', {name:/envase original/})).toBeVisible();
    const cta = page.getByRole('link',{name:'Descubre Luzela', exact:true});
    const box = await cta.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThan(height);
    await cta.click();
    for (const radio of await page.getByRole('radio').all()) {
      const bounds = await radio.boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

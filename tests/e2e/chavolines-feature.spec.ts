import { privateCode } from "./private-code";
import { expect, test } from "@playwright/test";
for (const width of [390,768,1440]) {
  test(`3X editorial feature and manual cart discount at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.goto("/");
    const card=page.locator('[data-summer-pack="3x"]');
    const mark=card.locator('[data-chavolines-feature]');
    await expect(mark).toContainText("EL FAVORITO");
    await expect(mark).toContainText("DE LOS");
    await expect(mark).toContainText("CHAVOLINES");
    await expect(page.locator('[data-chavolines-feature]')).toHaveCount(1);
    await expect(mark.locator('[data-cayena]')).toHaveCount(2);
    await expect(card.getByText("SUMMER DEAL",{exact:true})).toBeVisible();
    await expect(card.getByText("$819.00",{exact:true})).toBeVisible();
    await expect(card.getByText("$273.00 c/u",{exact:true})).toBeVisible();
    const markBox=await mark.boundingBox();
    const imageBox=await card.locator('[data-pack-image="card-3x"]').boundingBox();
    expect(markBox!.y+markBox!.height).toBeLessThanOrEqual(imageBox!.y+1);
    for(const image of await card.locator('[data-pack-bottle="card-3x"]').all()) {
      await expect(image).toHaveAttribute('src',/bottle\.webp/);
    }
    await page.locator('#tienda').screenshot({path:`docs/qa/prod-sync-pricing-${width}.png`});
    await card.screenshot({path:`docs/qa/prod-sync-3x-${width}.png`});
    expect(await page.content()).not.toContain(privateCode);
    await card.getByRole('link',{name:'Elegir 3X',exact:true}).click();
    const summary=page.locator('aside');
    const total=summary.locator('dt').filter({hasText:/^Total$/}).locator('..').locator('dd');
    await expect(total).toHaveText('$819.00');
    await page.getByRole('textbox',{name:'Código de descuento',exact:true}).fill(privateCode);
    await page.getByRole('button',{name:'Aplicar',exact:true}).click();
    await expect(total).toHaveText('$737.10');
    await expect(summary.getByText('−$81.90',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Aumentar cantidad',exact:true}).click();
    await expect(total).toHaveText('$1,474.20');
    await page.getByRole('button',{name:'Reducir cantidad',exact:true}).click();
    await expect(total).toHaveText('$737.10');
    await summary.screenshot({path:`docs/qa/prod-sync-cart-${width}.png`});
    const checkoutLink=page.getByRole('link',{name:'Continuar al checkout'});
    expect(await checkoutLink.getAttribute('href')).not.toContain(privateCode);
    await checkoutLink.click();
    await expect(page.getByRole("heading",{name:/Compra rápida/})).toBeVisible();
    await expect(page.getByText('✓ Descuento aplicado',{exact:false})).toBeVisible();
    await expect(page.getByRole('textbox',{name:'Código de descuento',exact:true})).toHaveValue('');
    if(width<1024) await page.getByText('Resumen de compra',{exact:true}).click();
    const checkoutSummary=page.locator(width<1024 ? 'details' : 'aside');
    await expect(checkoutSummary.locator('dt').filter({hasText:/^Total$/}).locator('..').locator('dd')).toHaveText('$737.10');
    await page.getByRole('button',{name:'Quitar código'}).click();
    await expect(checkoutSummary.locator('dt').filter({hasText:/^Total$/}).locator('..').locator('dd')).toHaveText('$819.00');
    await expect(page.locator('input[name="coupon_code"]')).toHaveValue('');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    // Handoff is one-time; a reload does not automatically apply it again.
    await page.reload();
    await expect(page.locator('input[name="coupon_code"]')).toHaveValue('');
  });
}

import { expect, test } from '@playwright/test';

for (const width of [1440,390]) {
  test(`V4 retains canonical editorial content and captures full page at ${width}`, async ({page}) => {
    await page.setViewportSize({width,height:width===390?844:900});
    await page.goto('/?funnel_qa=1');
    await expect(page.getByRole('region',{name:'Visto en',exact:true})).toBeVisible();
    await expect(page.getByAltText('El Mundo en Pareja',{exact:true})).toBeVisible();
    for (const name of ['Marcel','Azu','Ana K.','Ale G.']) await expect(page.locator('#resenas figcaption').filter({hasText:name})).toBeVisible();
    await expect(page.getByText('DEL CARIBE A TU RUTINA DIARIA')).toBeVisible();
    await expect(page.getByRole('region',{name:'LUZELA × CHAVOLINES',exact:true})).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/OME BARRE|Compra verificada|Recomendado por|EL FAVORITO/);
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('img').evaluateAll((images:HTMLImageElement[])=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));
    await page.screenshot({path:`docs/qa/v4/home-${width}.png`,fullPage:true});
    await page.screenshot({path:`docs/qa/v4/hero-${width}.png`});
    for(const[id,name]of [['#beneficios','benefits'],['#experiencia','experience'],['#summer-drop','campaign'],['#tienda','selector'],['#resenas','reviews'],['#historia','story'],['#colaboraciones','collaborations'],['footer','footer']]) {
      await page.locator(id).screenshot({path:`docs/qa/v4/${name}-${width}.png`});
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('Buen Fin concept is explicit, has no invented price and no promotional CTA', async ({page}) => {
  await page.goto('/?campaign_preview=buen-fin&funnel_qa=1');
  const concept=page.getByRole('region',{name:'Vista conceptual Buen Fin'});
  await expect(concept).toBeVisible();
  await expect(concept).toContainText('Promoción aún no activa');
  await expect(concept.getByRole('link')).toHaveCount(0);
  await expect(concept).not.toContainText(/\$|13 al 17|699|649|399/);
  await expect(page.getByRole('radio')).toHaveCount(3);
  await concept.screenshot({path:'docs/qa/v4/buen-fin-concept.png'});
});

test('Summer Drop remains separate from permanent hero and priced from catalog', async ({page}) => {
  await page.goto('/?funnel_qa=1');
  await expect(page.locator('main>section').first()).not.toContainText('Paga 2');
  const campaign=page.getByRole('region',{name:'Summer Drop',exact:true});
  await expect(campaign).toContainText('$769.00');
  await expect(campaign).toContainText('$819.00');
  await campaign.getByRole('link').click();
  await expect(page).toHaveURL(/\/summer-drop/);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Paga 2.Recibe 3.');
  await page.getByRole('link',{name:'COMPRAR SUMMER DROP',exact:true}).click();
  await expect(page).toHaveURL(/\/cart/);
  await page.getByRole('link',{name:'Continuar al checkout'}).click();
  await expect(page.locator('aside').filter({hasText:'Resumen'}).locator('dt').filter({hasText:/^Total$/}).locator('..').locator('dd')).toHaveText('$769.00');
});

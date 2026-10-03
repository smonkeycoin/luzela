import { privateCode } from "./private-code";
import { expect, test } from "@playwright/test";
const one = "193a1b97-0cc7-45bf-b4cd-84092a2a8ab8";
const two = "5967228b-715e-4f35-b6d8-a664547124ea";
const three = "5585efae-a6b2-4462-8ca7-707881a030c6";
const wholesale = "1b0755ae-0ede-4ad0-9357-192a693472c8";
const packs = [[one,45900,41310],[two,76900,69210],[three,76900,76900]] as const;
for (const width of [390,1440]) {
 test(`private code, prices and cart at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/?ref=chavolines&utm_source=elmundoenpareja");
  expect(await page.content()).not.toContain(privateCode);
  for(const [id,cents,total] of packs) {
   await page.goto(`/cart?variant=${id}&quantity=1`);
   await expect(page.getByText(`$${(cents/100).toFixed(2)}`,{exact:true}).first()).toBeVisible();
   expect(await page.content()).not.toContain(privateCode);
   await page.getByRole("link",{name:"Continuar al checkout"}).click();
   await expect(page.getByRole("heading",{name:/Compra rápida/})).toBeVisible();
   if (id === three) {
    await expect(page.getByText("SUMMER DROP ya incluye una promoción especial", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Código de descuento", exact: true })).toHaveCount(0);
    const summary = page.locator(width < 1024 ? "details" : "aside");
    if (width < 1024) await page.getByText("Resumen de compra", { exact: true }).click();
    await expect(summary.locator("dt").filter({ hasText: /^Total$/ }).locator("..").locator("dd")).toHaveText("$769.00");
    continue;
   }
   const input=page.getByRole("textbox",{name:"Código de descuento",exact:true});
   await expect(input).toHaveValue("");
   await expect(page.locator('input[name="coupon_code"]')).toHaveValue("");
   expect(await page.content()).not.toContain(privateCode);
   const summary=page.locator(width<1024 ? "details" : "aside");
   if(width<1024) await page.getByText("Resumen de compra",{exact:true}).click();
   await expect(summary.locator("dt").filter({hasText:/^Total$/}).locator("..").locator("dd")).toHaveText(`$${(cents/100).toFixed(2)}`);
   await input.fill(privateCode.toLowerCase());
   await page.getByRole("button",{name:"Aplicar",exact:true}).click();
   await expect(page.getByText("✓ Descuento aplicado",{exact:false})).toBeVisible();
   await expect(summary.locator("dt").filter({hasText:/^Total$/}).locator("..").locator("dd")).toHaveText(`$${(total/100).toFixed(2)}`);
   await page.locator('input[name="quantity"]').fill("2");
   await expect(summary.getByText("Cantidad: 2 packs")).toBeVisible();
   await expect(summary.locator("dt").filter({hasText:/^Total$/}).locator("..").locator("dd")).toHaveText(new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(total*2/100));
   await page.getByRole("button",{name:"Quitar código"}).click();
   await expect(page.locator('input[name="coupon_code"]')).toHaveValue("");
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.goto("/chavolines");
  await expect(page).toHaveURL(/\/\?.*ref=chavolines.*#tienda$/);
  expect(await page.content()).not.toContain(privateCode);
  await page.locator("#tienda").screenshot({path:`docs/qa/pricing-18-storefront-${width}.png`});
  expect(errors).toEqual([]);
 });
}
test("server quotes all three packs, rejects hidden packs and unknown codes",async({request})=>{
 for(const [variant,subtotalCents,total] of packs) {
  const r=await request.post("/api/promo",{data:{code:privateCode,variant,quantity:1}});
  if (variant === three) { expect(r.status()).toBe(400); continue; }
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({percent:10,subtotalCents,discountCents:subtotalCents-total});
 }
 for(const [variant,code] of [[wholesale,privateCode],[one,"MADEUP"]]) {
  const r=await request.post("/api/promo",{data:{code,variant,quantity:1}});
  expect([400,404]).toContain(r.status());
  expect(await r.text()).not.toContain(privateCode);
 }
});
test("public pages and their loaded JavaScript never suggest the code",async({page,request})=>{
 for(const path of ["/","/cart","/faq","/shipping","/privacy","/terms","/returns","/checkout/payment","/checkout/success","/collab/login","/auth/login",`/checkout?variant=${one}&coupon=${privateCode}`]) {
  await page.goto(path);
  // URL parameters are never read to prefill/apply the coupon. Next may serialize the requested URL in RSC.
  expect(await page.locator("body").innerText()).not.toContain(privateCode);
  const scripts=await page.locator("script[src]").evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src));
  for(const src of scripts) expect(await (await request.get(src)).text()).not.toContain(privateCode);
 }
 await expect(page.getByRole("textbox",{name:"Código de descuento",exact:true})).toHaveValue("");
 await expect(page.locator('input[name="coupon_code"]')).toHaveValue("");
});
test("anonymous visitors cannot open portal, admin or CSV", async ({
  page,
  request,
}) => {
  await page.goto("/collab");
  await expect(page).toHaveURL(/\/collab\/login/);
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  expect(
    (
      await request.get(
        "/collab/export?collaborator=bbbbbbbb-0000-4000-8000-000000000002",
      )
    ).status(),
  ).toBe(401);
  await page.goto("/admin/collaborations");
  await expect(page).toHaveURL(/\/auth\/login/);
});

test("collaborator login hands off to Google with the protected callback", async ({ page, context }) => {
  let authorizationUrl = "";
  await page.route("**/auth/v1/authorize?**", async route => {
    authorizationUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: "text/html", body: "OAuth handoff captured for QA" });
  });
  await page.goto("/collab/login?funnel_qa=1");
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await expect.poll(() => authorizationUrl).toContain("provider=google");
  const url = new URL(authorizationUrl);
  expect(url.searchParams.get("prompt")).toBe("select_account");
  expect(new URL(url.searchParams.get("redirect_to")!).pathname).toBe("/auth/callback");
  expect((await context.cookies()).find(cookie => cookie.name === "luzela_auth_destination")?.value).toBe("collab");
});

test("checkout shows stale-promo rejection without losing customer input or submitting twice", async ({
  page,
}) => {
  await page.goto(`/checkout?variant=${one}`);
  let requests = 0;
  await page.route("**/api/checkout", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "invalid_promo",
        detail: "El código ya no está disponible.",
      }),
    });
  });
  for (const [name, value] of Object.entries({
    email: "qa@example.invalid",
    phone: "5555555555",
    full_name: "QA Test",
    address_line1: "QA Calle 123",
    city: "Cancun",
    state: "Quintana Roo",
    postal_code: "77500",
  }))
    await page.locator(`input[name="${name}"]`).fill(value);
  const button = page.getByRole("button", { name: "Continuar a pago seguro" });
  await page
    .locator('form[action="/api/checkout"]')
    .evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
  await expect(page.locator('form [role="alert"]')).toHaveText(
    "El código ya no está disponible.",
  );
  expect(requests).toBe(1);
  await expect(page.locator('input[name="email"]')).toHaveValue(
    "qa@example.invalid",
  );
  await expect(button).toBeEnabled();
});

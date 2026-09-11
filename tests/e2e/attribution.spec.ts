import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.describe("storefront attribution capture", () => {
  test("captures Meta UTM, preserves first touch, updates last touch, and hands off to checkout", async ({
    page,
  }) => {
    await page.goto(
      "/?utm_source=meta&utm_medium=paid_social&utm_campaign=summer&utm_content=family_v2&utm_term=adset_a",
    );

    const firstSnapshot = await readAttribution(page, "meta");
    expect(firstSnapshot.first_touch.source).toBe("meta");
    expect(firstSnapshot.first_touch.medium).toBe("paid_social");
    expect(firstSnapshot.first_touch.campaign).toBe("summer");
    expect(firstSnapshot.last_touch.content).toBe("family_v2");

    await page.goto("/cart");
    const cartSnapshot = await readAttribution(page);
    expect(cartSnapshot.first_touch.source).toBe("meta");
    expect(cartSnapshot.last_touch.source).toBe("meta");

    await page.goto(
      "/?utm_source=instagram&utm_medium=organic&utm_campaign=profile&utm_content=bio",
    );
    const updatedSnapshot = await readAttribution(page, "instagram");
    expect(updatedSnapshot.first_touch.source).toBe("meta");
    expect(updatedSnapshot.first_touch.campaign).toBe("summer");
    expect(updatedSnapshot.last_touch.source).toBe("instagram");
    expect(updatedSnapshot.last_touch.campaign).toBe("profile");

    await page.getByRole("link", { name: /Elegir/ }).first().click();
    const checkoutLink = page.getByRole("link", { name: "Continuar al checkout" });
    await expect(checkoutLink).toBeVisible();
    await checkoutLink.click();
    const field = page.getByTestId("attribution-payload");
    await expect(field).toHaveValue(/instagram/);
    const checkoutPayload = JSON.parse((await field.inputValue()) || "{}");

    expect(checkoutPayload.first_touch.source).toBe("meta");
    expect(checkoutPayload.last_touch.source).toBe("instagram");
  });

  test("fresh direct traffic captures direct / none without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.removeItem("luzela_attribution_v1"));
    await page.reload();

    const snapshot = await readAttribution(page);
    expect(snapshot.last_touch.source).toBe("direct");
    expect(snapshot.last_touch.medium).toBe("none");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?utm_source=meta&utm_medium=paid_social&utm_campaign=mobile");
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});

async function readAttribution(page: Page, expectedLastSource?: string) {
  await page.waitForFunction(
    (source) => {
      const raw = window.localStorage.getItem("luzela_attribution_v1");

      if (!raw) {
        return false;
      }

      if (!source) {
        return true;
      }

      try {
        return JSON.parse(raw).last_touch?.source === source;
      } catch {
        return false;
      }
    },
    expectedLastSource,
  );

  return page.evaluate(() => JSON.parse(window.localStorage.getItem("luzela_attribution_v1") || "{}"));
}

import { describe, expect, it } from "vitest";
import { captureAttribution } from "./index";

describe("dedicated Summer Drop attribution", () => {
  it("identifies the clean campaign route without inventing an acquisition source", () => {
    const value = captureAttribution(null, { url: "https://www.luzela.mx/summer-drop" });
    expect(value.last_touch).toMatchObject({ campaign: "summer_drop", source: "direct", medium: "none", landing_path: "/summer-drop" });
  });

  it.each(["story_01", "story_02", "feed_launch"])("preserves Instagram %s through cart and checkout", (content) => {
    const campaign = captureAttribution(null, { url: `https://www.luzela.mx/summer-drop?utm_source=instagram&utm_medium=organic_social&utm_campaign=summer_drop&utm_content=${content}` });
    const checkout = captureAttribution(campaign, { url: "https://www.luzela.mx/checkout?variant=example", referrer: "https://www.luzela.mx/cart" });
    expect(checkout.first_touch).toMatchObject({ source: "instagram", medium: "organic_social", campaign: "summer_drop", content });
    expect(checkout.last_touch).toMatchObject({ source: "instagram", campaign: "summer_drop", content });
  });

  it("preserves Chavolines credit when the visitor opens the internal campaign route", () => {
    const collab = captureAttribution(null, { url: "https://www.luzela.mx/?ref=chavolines&utm_source=elmundoenpareja&utm_medium=creator&utm_campaign=luzela_x_chavolines" });
    const campaign = captureAttribution(collab, { url: "https://www.luzela.mx/summer-drop", referrer: "https://www.luzela.mx/" });
    expect(campaign.first_touch).toEqual(collab.first_touch);
    expect(campaign.collab_touch).toEqual(collab.collab_touch);
    expect(campaign.last_touch).toMatchObject({ campaign: "summer_drop", source: "elmundoenpareja", medium: "creator", ref: "chavolines" });
  });
});

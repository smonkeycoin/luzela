import { describe, expect, it } from "vitest";

import {
  captureAttribution,
  classifyAttributionGroup,
  isInternalReferrer,
  parseAttributionPayload,
  toOrderAttributionSnapshot,
} from "./index";

describe("attribution", () => {
  it("captures and sanitizes UTM fields", () => {
    const snapshot = captureAttribution(null, {
      now: new Date("2026-08-13T10:00:00.000Z"),
      referrer: "https://instagram.com/luzela",
      url: "https://luzela.mx/?utm_source=Meta&utm_medium=Paid_Social&utm_campaign=Summer%20Launch&utm_content=<family_v2>&utm_term=adset",
    });

    expect(snapshot.first_touch.source).toBe("meta");
    expect(snapshot.first_touch.medium).toBe("paid_social");
    expect(snapshot.first_touch.campaign).toBe("Summer Launch");
    expect(snapshot.first_touch.content).toBe("family_v2");
    expect(snapshot.first_touch.term).toBe("adset");
  });

  it("preserves first touch and updates last touch with a later campaign", () => {
    const first = captureAttribution(null, {
      now: new Date("2026-08-13T10:00:00.000Z"),
      url: "https://luzela.mx/?utm_source=meta&utm_medium=paid_social&utm_campaign=summer_a",
    });
    const second = captureAttribution(first, {
      now: new Date("2026-08-13T11:00:00.000Z"),
      url: "https://luzela.mx/?utm_source=instagram&utm_medium=organic&utm_campaign=profile",
    });

    expect(second.first_touch.source).toBe("meta");
    expect(second.first_touch.campaign).toBe("summer_a");
    expect(second.last_touch.source).toBe("instagram");
    expect(second.last_touch.campaign).toBe("profile");
  });

  it("does not let direct internal navigation erase a prior attribution", () => {
    const first = captureAttribution(null, {
      now: new Date("2026-08-13T10:00:00.000Z"),
      url: "https://luzela.mx/?utm_source=meta&utm_medium=paid_social&utm_campaign=summer",
    });
    const internal = captureAttribution(first, {
      now: new Date("2026-08-13T10:05:00.000Z"),
      referrer: "https://luzela.mx/",
      url: "https://luzela.mx/cart",
    });

    expect(internal.last_touch.source).toBe("meta");
    expect(isInternalReferrer("https://luzela.mx/", "https://luzela.mx/cart")).toBe(true);
  });

  it("classifies external referrers and direct traffic conservatively", () => {
    const google = captureAttribution(null, {
      now: new Date("2026-08-13T10:00:00.000Z"),
      referrer: "https://www.google.com/search?q=luzela",
      url: "https://luzela.mx/",
    });
    const direct = captureAttribution(null, {
      now: new Date("2026-08-13T10:00:00.000Z"),
      url: "https://luzela.mx/",
    });

    expect(google.last_touch.source).toBe("google");
    expect(google.last_touch.medium).toBe("organic");
    expect(direct.last_touch.source).toBe("direct");
    expect(direct.last_touch.medium).toBe("none");
  });

  it("creates an order-safe snapshot and parses payloads defensively", () => {
    const snapshot = captureAttribution(null, {
      now: new Date("2026-08-13T10:00:00.000Z"),
      url: "https://luzela.mx/?utm_source=meta&utm_medium=paid_social&utm_campaign=summer",
    });
    const parsed = parseAttributionPayload(JSON.stringify(snapshot));
    const orderSnapshot = toOrderAttributionSnapshot(parsed);

    expect(orderSnapshot.last_touch_source).toBe("meta");
    expect(orderSnapshot.last_touch_campaign).toBe("summer");
    expect(parseAttributionPayload("{bad json")).toBeNull();
    expect(classifyAttributionGroup("meta", "paid_social")).toBe("paid_social");
  });
});

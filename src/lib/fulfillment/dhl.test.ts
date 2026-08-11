import { describe, expect, it } from "vitest";

import {
  getDhlTrackingUrl,
  isValidDhlTrackingNumber,
  normalizeDhlTrackingNumber,
} from "./dhl";

describe("DHL fulfillment helpers", () => {
  it("normalizes tracking numbers before persistence", () => {
    expect(normalizeDhlTrackingNumber("  jd 014 600 003 mx ")).toBe(
      "JD014600003MX",
    );
  });

  it("rejects empty or unsafe tracking numbers", () => {
    expect(isValidDhlTrackingNumber("")).toBe(false);
    expect(isValidDhlTrackingNumber("abc")).toBe(false);
    expect(isValidDhlTrackingNumber("ABC<script>")).toBe(false);
  });

  it("accepts DHL-style alphanumeric tracking numbers", () => {
    expect(isValidDhlTrackingNumber("JD014600003MX")).toBe(true);
    expect(isValidDhlTrackingNumber("1234567890")).toBe(true);
  });

  it("uses the official DHL Mexico tracking portal", () => {
    expect(getDhlTrackingUrl()).toBe("https://www.dhl.com/mx-es/home/rastreo.html");
  });
});

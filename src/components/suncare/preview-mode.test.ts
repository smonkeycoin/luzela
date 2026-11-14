import { describe, expect, it } from "vitest";
import { isVisualSuncarePreview } from "./preview-mode";

describe("visual preview isolation", () => {
  it("never substitutes a snapshot for production, including a missing backend", () => {
    expect(isVisualSuncarePreview("production", undefined)).toBe(false);
    expect(isVisualSuncarePreview("production", "https://configured.example")).toBe(false);
    expect(isVisualSuncarePreview(undefined, undefined)).toBe(false);
  });
  it("only enables the visual snapshot in an unconfigured Preview", () => {
    expect(isVisualSuncarePreview("preview", undefined)).toBe(true);
    expect(isVisualSuncarePreview("preview", "https://test-backend.example")).toBe(false);
  });
});

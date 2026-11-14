/** Visual-only fallback is opt-in by deployment environment, never a production fallback. */
export function isVisualSuncarePreview(environment: string | undefined, backendUrl: string | undefined) {
  return environment === "preview" && !backendUrl;
}

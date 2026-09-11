// Inject through the local environment or a CI secret, never through a public URL.
export const privateCode = process.env.E2E_COLLAB_CODE || "";
if (!privateCode) throw new Error("Set E2E_COLLAB_CODE to run private-coupon browser QA.");

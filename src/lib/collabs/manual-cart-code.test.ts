import { expect, it } from "vitest";
import { readManualCartCode } from "./manual-cart-code";
it("only transfers the customer's recent explicit code for the same variant", () => {
  const now = 1000000;
  const value = JSON.stringify({variant:"3x",code:"EXPLICIT-CUSTOMER-CODE",appliedAt:now-1000});
  expect(readManualCartCode(value,"3x",now)).toBe("EXPLICIT-CUSTOMER-CODE");
  expect(readManualCartCode(value,"1x",now)).toBe("");
  expect(readManualCartCode(value,"3x",now+600000)).toBe("");
  expect(readManualCartCode(value,"3x",now-2000)).toBe("");
  expect(readManualCartCode(null,"3x",now)).toBe("");
  expect(readManualCartCode("invalid-json","3x",now)).toBe("");
  expect(readManualCartCode(JSON.stringify({ref:"chavolines"}),"3x",now)).toBe("");
});

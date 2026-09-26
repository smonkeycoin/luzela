import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/analytics/commerce", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/analytics/commerce")>();
  return { ...original, recordCommerceEvent: mocks.record };
});
import { POST } from "./route";

beforeEach(() => mocks.record.mockReset());

describe("browser analytics authority", () => {
  it("rejects purchase and unknown customer fields", async () => {
    const id = crypto.randomUUID();
    for (const payload of [
      { event_name: "purchase", anonymous_session_id: id },
      { event_name: "add_to_cart", anonymous_session_id: id, email: "customer@example.com" },
    ]) {
      const response = await POST(new Request("https://luzela.mx/api/analytics", { method: "POST", body: JSON.stringify(payload) }));
      expect(response.status).toBe(400);
    }
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("isolates client event keys from server purchase keys and flags automation", async () => {
    const id = crypto.randomUUID();
    const response = await POST(new Request("https://luzela.mx/api/analytics", {
      method: "POST", headers: { "user-agent": "Playwright" },
      body: JSON.stringify({ event_name: "add_to_cart", anonymous_session_id: id, event_key: `purchase:${id}` }),
    }));
    expect(response.status).toBe(204);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ event_key: `client:purchase:${id}`, is_qa: true }));
  });
});

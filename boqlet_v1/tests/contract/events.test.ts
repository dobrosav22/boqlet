import { describe, expect, it } from "vitest";
import { API_URL } from "../support/env";
import { user } from "../support/users";

/** conventions.md "Server-Sent Events". */
describe("events: GET /events", () => {
  it("opens an event stream that proxies must not buffer", async () => {
    const controller = new AbortController();
    const res = await fetch(`${API_URL}/events`, {
      headers: { Authorization: `Bearer ${(await user("olivia")).token}` },
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-transform");
    const first = await res.body!.getReader().read();
    expect(new TextDecoder().decode(first.value)).toMatch(/^(:|id:|event:)/);
    controller.abort();
  });
});

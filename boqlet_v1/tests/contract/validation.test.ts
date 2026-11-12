import { describe, expect, it } from "vitest";
import { API_URL } from "../support/env";
import { user } from "../support/users";

/** conventions.md "Requests and responses" and "Errors": invalid input is a 400 with a code. */
describe("request validation", () => {
  const send = async (method: string, path: string, body?: string) =>
    fetch(API_URL + path, {
      method,
      headers: { Authorization: `Bearer ${(await user("olivia")).token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body,
    });

  it("rejects unknown fields with 400 unknown_field", async () => {
    const res = await send("POST", "/orgs", JSON.stringify({ name: "Test firm", slug: "test-firm", colour: "red" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "unknown_field" });
  });

  it("rejects a body that breaks the schema with 400 invalid_body", async () => {
    const res = await send("POST", "/orgs", JSON.stringify({ name: "Test firm", slug: "Not a slug!" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("rejects malformed JSON with 400 invalid_body", async () => {
    const res = await send("POST", "/orgs", "{");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("rejects an id that is not a uuid with 400", async () => {
    const res = await send("GET", "/orgs/not-a-uuid");
    expect(res.status).toBe(400);
  });
});

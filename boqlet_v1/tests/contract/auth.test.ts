import { describe, expect, it } from "vitest";
import { API_URL } from "../support/env";
import { operationsByTag, samplePath, spec } from "../support/contract";

/**
 * One contract group per tag of `openapi.yaml`: every secured operation refuses a request
 * without credentials with `401 unauthenticated` and the contract's error body, and public
 * operations (`security: []`) never ask for credentials (conventions.md "Authentication").
 */
const s = await spec();
const byTag = operationsByTag(s);

for (const [tag, ops] of [...byTag].sort(([a], [b]) => a.localeCompare(b))) {
  describe(`tag ${tag}`, () => {
    for (const op of ops) {
      const path = samplePath(op);
      if (op.secured) {
        it(`${op.operationId}: ${op.method} ${op.path} needs credentials`, async () => {
          const res = await fetch(API_URL + path, {
            method: op.method,
            headers: op.method === "GET" || op.method === "DELETE" ? {} : { "Content-Type": "application/json" },
            body: op.method === "GET" || op.method === "DELETE" ? undefined : "{}",
          });
          expect(res.status).toBe(401);
          const body = (await res.json()) as { code: string; message: string };
          expect(body.code).toBe("unauthenticated");
          expect(typeof body.message).toBe("string");
        });
      } else {
        it(`${op.operationId}: ${op.method} ${op.path} is public`, async () => {
          const res = await fetch(API_URL + path, { method: op.method, redirect: "manual" });
          expect(res.status).not.toBe(401);
        });
      }
    }
  });
}

it("covers every tag the contract declares", () => {
  const declared = ((s.doc.tags as { name: string }[] | undefined) ?? []).map((t) => t.name);
  for (const tag of declared) expect(byTag.has(tag), `no operation for tag ${tag}`).toBe(true);
});

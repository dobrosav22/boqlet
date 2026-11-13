import { Hono } from "hono";
import { cors } from "hono/cors";
import { blobPath, getBlob, putBlob, verifySignature } from "./blobs.js";
import { devRoutes } from "./dev.js";
import { coreHandlers } from "./handlers/core.js";
import { orgHandlers } from "./handlers/orgs.js";
import { projectHandlers } from "./handlers/projects.js";
import { modelHandlers } from "./handlers/models.js";
import { presetHandlers } from "./handlers/presets.js";
import { boqHandlers } from "./handlers/boqs.js";
import { lineHandlers } from "./handlers/lines.js";
import { decisionHandlers } from "./handlers/decisions.js";
import { adjustmentHandlers } from "./handlers/adjustments.js";
import { sessionHandlers } from "./handlers/sessions.js";
import { apiRouter, type Handlers } from "./router.js";
import { buildSeed } from "./seed.js";
import { loadSpec } from "@ifc-boq/api/spec";
import { loadStore, replaceStore } from "./store.js";

/** All handlers, by operationId. Each task adds its file here. */
export const handlers: Handlers = { ...coreHandlers, ...orgHandlers, ...projectHandlers, ...modelHandlers, ...presetHandlers, ...boqHandlers, ...lineHandlers, ...decisionHandlers, ...adjustmentHandlers, ...sessionHandlers };

/** Builds the mock: loads (or seeds) the store and the contract. Used by the server and the tests. */
export async function createApp(opts: { reseed?: boolean } = {}) {
  if (opts.reseed || !loadStore()) replaceStore(buildSeed());
  const spec = await loadSpec();
  const app = new Hono();

  // Browsers PUT uploads straight to the signed blob URLs on this port, so CORS is open in dev.
  app.use("*", cors({ origin: (origin) => origin ?? "*", allowHeaders: ["Authorization", "Content-Type", "If-Match", "Idempotency-Key", "Last-Event-ID"], exposeHeaders: ["ETag", "Location"], credentials: true }));

  app.get("/", (c) => c.json({ service: "boqlet mock API", contract: "packages/api/openapi.yaml", api: "/api/v1", dev: ["/_dev/users", "/_dev/clock", "/_dev/outbox", "/_dev/checkout", "/_dev/emit"] }));
  app.route("/", devRoutes());

  app.get("/_blobs/*", async (c) => {
    const key = decodeURIComponent(new URL(c.req.url).pathname.slice("/_blobs/".length));
    const check = verifySignature(key, "GET", c.req.query("exp"), c.req.query("sig"));
    if (check !== "ok") return c.json({ code: check === "expired" ? "url_expired" : "forbidden", message: "Bad or expired signature" }, 403);
    try {
      blobPath(key);
      const data = await getBlob(key);
      return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/octet-stream" } });
    } catch {
      return c.json({ code: "not_found", message: "No such object" }, 404);
    }
  });
  app.put("/_blobs/*", async (c) => {
    const key = decodeURIComponent(new URL(c.req.url).pathname.slice("/_blobs/".length));
    const check = verifySignature(key, "PUT", c.req.query("exp"), c.req.query("sig"));
    if (check !== "ok") return c.json({ code: check === "expired" ? "url_expired" : "forbidden", message: "Bad or expired signature" }, 403);
    await putBlob(key, new Uint8Array(await c.req.arrayBuffer()));
    return new Response(null, { status: 200, headers: { ETag: `"${Date.now()}"` } });
  });

  app.all("/api/v1/*", apiRouter(spec, handlers));
  app.all("/api/v1", apiRouter(spec, handlers));
  return app;
}

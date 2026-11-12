import { SSEStreamingApi } from "hono/streaming";
import { subscribe } from "../events.js";
import { json, type Handlers } from "../router.js";
import { db } from "../store.js";

/** FE-003: who am I, the plans, and the event stream. Later tasks add their own handler files. */
export const coreHandlers: Handlers = {
  getMe({ user }) {
    const store = db();
    const memberships = store.memberships
      .filter((m) => m.userId === user!.id)
      .map((m) => ({ org: store.orgs.find((o) => o.id === m.orgId)!, role: m.role }))
      .filter((m) => m.org);
    return json({ user, memberships, modules: {} });
  },

  listPlans() {
    return json(db().plans);
  },

  streamEvents({ c, user }) {
    const lastEventId = c.req.header("Last-Event-ID") ?? c.req.query("lastEventId") ?? null;
    // Built by hand rather than with streamSSE: its `Cache-Control: no-cache` lacks `no-transform`,
    // and without it proxies and compression (the Next dev rewrite gzips) buffer the stream.
    // `X-Accel-Buffering` does the same for nginx-style ingresses. Headers are set before the
    // response exists because @hono/node-server snapshots them.
    const { readable, writable } = new TransformStream();
    const stream = new SSEStreamingApi(writable, readable);
    void (async () => {
      const queue: Promise<void>[] = [];
      const off = subscribe(
        user!.id,
        (e) => {
          queue.push(stream.writeSSE({ id: e.id, event: e.event, data: JSON.stringify(e.data) }));
        },
        lastEventId,
      );
      stream.onAbort(off);
      try {
        // Heartbeat comments every 25 s (conventions.md); the loop ends when the client goes away.
        while (!stream.aborted && !stream.closed) {
          await Promise.all(queue.splice(0));
          await stream.write(": ping\n\n");
          await stream.sleep(25_000);
        }
      } catch {
        /* client gone */
      } finally {
        off();
        void stream.close().catch(() => {});
      }
    })();
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("Connection", "keep-alive");
    c.header("X-Accel-Buffering", "no");
    return c.newResponse(stream.responseReadable);
  },
};

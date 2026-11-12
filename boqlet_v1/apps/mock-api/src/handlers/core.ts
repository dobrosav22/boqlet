import { streamSSE } from "hono/streaming";
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
    return streamSSE(c, async (stream) => {
      const queue: Promise<void>[] = [];
      const off = subscribe(
        user!.id,
        (e) => {
          queue.push(stream.writeSSE({ id: e.id, event: e.event, data: JSON.stringify(e.data) }));
        },
        lastEventId,
      );
      stream.onAbort(off);
      // Heartbeat comments every 25 s (conventions.md); the loop ends when the client goes away.
      while (!stream.aborted && !stream.closed) {
        await Promise.all(queue.splice(0));
        await stream.write(": ping\n\n");
        await stream.sleep(25_000);
      }
      off();
    });
  },
};

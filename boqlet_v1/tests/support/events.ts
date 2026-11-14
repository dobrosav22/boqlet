import { API_URL } from "./env";

export interface ReceivedEvent {
  event: string;
  data: unknown;
}

/** Listens to `GET /events` as one person and collects what arrives (conventions.md "Server-Sent Events"). */
export async function listen(token: string) {
  const controller = new AbortController();
  const res = await fetch(`${API_URL}/events`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
  if (!res.ok) throw new Error(`/events answered ${res.status}`);
  const events: ReceivedEvent[] = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const event = /^event: (.*)$/m.exec(block)?.[1];
          const data = /^data: (.*)$/m.exec(block)?.[1];
          if (event && data !== undefined) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return {
    events,
    /** The first event of `name` matching `where`, waiting up to `timeoutMs`. */
    async next<T>(name: string, where: (data: T) => boolean = () => true, timeoutMs = 5_000): Promise<T> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const hit = events.find((e) => e.event === name && where(e.data as T));
        if (hit) return hit.data as T;
        if (Date.now() > deadline) throw new Error(`no ${name} within ${timeoutMs} ms (got ${events.map((e) => e.event).join(", ")})`);
        await new Promise((r) => setTimeout(r, 25));
      }
    },
    close: () => controller.abort(),
  };
}

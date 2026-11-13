import { EventStreamContentType, fetchEventSource } from "@microsoft/fetch-event-source";
import { API_BASE_URL } from "@/config";
import type { RealtimeEvent } from "./invalidation";

/**
 * One SSE connection per tab to `GET /events` (conventions.md). fetch-event-source sends the
 * auth header (EventSource can't), retries with backoff after a drop, and sends `Last-Event-ID`
 * on reconnect so the server replays what was missed. Returns a function that closes it.
 */
export function connectRealtime(opts: {
  getToken: () => Promise<string | null>;
  onEvent: (e: RealtimeEvent & { id: string }) => void;
  onStatus?: (status: "open" | "retrying" | "closed") => void;
  /** The stream was refused with 401: the error's code (e.g. `session_replaced`, F01 §10). */
  onUnauthorized?: (code: string) => void;
}): () => void {
  const controller = new AbortController();
  let delay = 1000;
  void fetchEventSource(`${API_BASE_URL}/events`, {
    signal: controller.signal,
    openWhenHidden: true,
    async fetch(input, init) {
      const token = await opts.getToken();
      const headers = new Headers(init?.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    async onopen(res) {
      if (res.ok && res.headers.get("content-type")?.startsWith(EventStreamContentType)) {
        delay = 1000;
        opts.onStatus?.("open");
        return;
      }
      // 401: the session is gone; stop and let the auth gate take over.
      if (res.status === 401) {
        const code = await res
          .json()
          .then((b: { code?: string }) => b.code ?? "unauthenticated")
          .catch(() => "unauthenticated");
        opts.onUnauthorized?.(code);
        throw new FatalError("401");
      }
      if (res.status === 403) throw new FatalError(String(res.status));
      throw new Error(`events: ${res.status}`);
    },
    onmessage(msg) {
      if (!msg.event) return;
      let data: Record<string, unknown> = {};
      try {
        data = msg.data ? (JSON.parse(msg.data) as Record<string, unknown>) : {};
      } catch {
        return;
      }
      opts.onEvent({ id: msg.id, event: msg.event, data });
    },
    onerror(err) {
      if (err instanceof FatalError) {
        opts.onStatus?.("closed");
        throw err;
      }
      opts.onStatus?.("retrying");
      delay = Math.min(delay * 2, 30_000);
      return delay;
    },
  }).catch(() => opts.onStatus?.("closed"));
  return () => controller.abort();
}

class FatalError extends Error {}

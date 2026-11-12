/**
 * The SSE bus behind `GET /api/v1/events` (conventions.md "Server-Sent Events"): events get
 * increasing ids, and the last 1000 are kept so a client reconnecting with `Last-Event-ID` gets
 * what it missed. An event goes to the users it names, or to everyone when it names nobody.
 */
export interface BusEvent {
  id: string;
  event: string;
  data: unknown;
  userIds?: string[];
}
type Listener = (e: BusEvent) => void;

const RING = 1000;
const ring: BusEvent[] = [];
const listeners = new Set<{ userId: string; fn: Listener }>();
let counter = 0;

export function emit(event: string, data: unknown, opts: { userIds?: string[] } = {}): BusEvent {
  counter += 1;
  // Fixed-width ids compare as strings in time order.
  const e: BusEvent = { id: `${Date.now()}`.padStart(15, "0") + `${counter % 100000}`.padStart(5, "0"), event, data, userIds: opts.userIds };
  ring.push(e);
  if (ring.length > RING) ring.shift();
  for (const l of listeners) if (visible(e, l.userId)) l.fn(e);
  return e;
}

const visible = (e: BusEvent, userId: string) => !e.userIds || e.userIds.includes(userId);

/** Subscribes a user; replays what came after `lastEventId`. Returns the unsubscribe function. */
export function subscribe(userId: string, fn: Listener, lastEventId?: string | null): () => void {
  if (lastEventId) for (const e of ring) if (e.id > lastEventId && visible(e, userId)) fn(e);
  const entry = { userId, fn };
  listeners.add(entry);
  return () => {
    listeners.delete(entry);
  };
}

export const listenerCount = () => listeners.size;

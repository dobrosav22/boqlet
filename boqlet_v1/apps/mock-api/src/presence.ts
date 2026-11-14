/**
 * Who has a BoQ open (F06 §14, P31): kept in memory, as the backend keeps it per instance
 * (07-backend/architecture.md "Live co-editing"). `PUT /boqs/{id}/presence` every 20 s keeps a
 * person in; 45 s without one (or `DELETE`) takes them out. Every change goes to everyone in the BoQ
 * as `boq.presence`; `boq.line_edited` goes to everyone in it after a saved edit.
 */
import { emit } from "./events.js";
import { nowIso } from "./clock.js";
import type { UserRec } from "./store.js";

const TTL_MS = Number(process.env.MOCK_PRESENCE_TTL_MS ?? 45_000);

interface Entry {
  name: string;
  lineKey: string | null;
  seenAt: number;
}
const byBoq = new Map<string, Map<string, Entry>>();

function sweep(boqId: string): boolean {
  const users = byBoq.get(boqId);
  if (!users) return false;
  let removed = false;
  for (const [id, e] of users) {
    if (Date.now() - e.seenAt > TTL_MS) {
      users.delete(id);
      removed = true;
    }
  }
  if (users.size === 0) byBoq.delete(boqId);
  return removed;
}

export function presenceOf(boqId: string) {
  sweep(boqId);
  const users = byBoq.get(boqId) ?? new Map<string, Entry>();
  return { boqId, users: [...users].map(([userId, e]) => ({ userId, name: e.name, lineKey: e.lineKey })).sort((a, b) => a.name.localeCompare(b.name)) };
}

export const presentUserIds = (boqId: string) => presenceOf(boqId).users.map((u) => u.userId);

function broadcast(boqId: string, extra: string[] = []) {
  const p = presenceOf(boqId);
  emit("boq.presence", p, { userIds: [...new Set([...p.users.map((u) => u.userId), ...extra])] });
}

/** A heartbeat (and the line being edited); announces a change of who is in or of their line. */
export function touchPresence(boqId: string, user: UserRec, lineKey: string | null) {
  const swept = sweep(boqId);
  const users = byBoq.get(boqId) ?? new Map<string, Entry>();
  byBoq.set(boqId, users);
  const before = users.get(user.id);
  users.set(user.id, { name: user.name, lineKey, seenAt: Date.now() });
  if (swept || !before || before.lineKey !== lineKey) broadcast(boqId);
  return presenceOf(boqId);
}

export function leavePresence(boqId: string, userId: string) {
  const users = byBoq.get(boqId);
  if (!users?.delete(userId)) return;
  if (users.size === 0) byBoq.delete(boqId);
  broadcast(boqId, [userId]);
}

/** After a saved edit (F06 §14): to everyone with the BoQ open, the editor included (their other tabs). */
export function announceLineEdits(boqId: string, lineKeys: string[], by: UserRec) {
  if (!lineKeys.length) return;
  const userIds = presentUserIds(boqId);
  if (!userIds.includes(by.id)) userIds.push(by.id);
  emit("boq.line_edited", { boqId, lineKeys: [...new Set(lineKeys)], by: { id: by.id, name: by.name }, at: nowIso() }, { userIds });
}

// People who close the tab without DELETE drop out after the TTL; tell the others when they do.
const timer = setInterval(() => {
  for (const boqId of [...byBoq.keys()]) if (sweep(boqId)) broadcast(boqId);
}, 10_000);
timer.unref();

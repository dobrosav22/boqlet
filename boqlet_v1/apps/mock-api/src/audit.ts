import { nowIso } from "./clock.js";
import { newId } from "./ids.js";
import { db, persist, type AuditRec } from "./store.js";

/** Appends an audit event (testing.md: every new write action is audited). */
export function audit(e: Omit<AuditRec, "id" | "at">): AuditRec {
  const rec: AuditRec = { id: newId(), at: nowIso(), ...e };
  db().audit.push(rec);
  persist();
  return rec;
}

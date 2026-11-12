import { db, type UserRec } from "./store.js";

/** Mock auth (conventions.md): `Authorization: Bearer mock:<userId>`, any seeded user. */
export function userFromAuthorization(header: string | undefined | null): UserRec | null {
  const m = /^Bearer mock:(\S+)$/i.exec(header ?? "");
  if (!m) return null;
  return db().users.find((u) => u.id === m[1]) ?? null;
}

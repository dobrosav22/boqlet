import { createHash, randomBytes } from "node:crypto";

/** A UUID v7 (time-ordered, conventions.md "Identifiers"). */
export function newId(): string {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return format(bytes);
}

/** A stable UUID for seed data (v8-style from a name), so seeds are the same on every machine. */
export function seedId(name: string): string {
  const bytes = createHash("sha256").update(`boqlet-seed:${name}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return format(bytes);
}

function format(b: Uint8Array) {
  const h = Buffer.from(b).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

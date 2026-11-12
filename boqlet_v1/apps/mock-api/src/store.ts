/**
 * The mock's state: one in-memory object, persisted to `<dataDir>/db.json` (debounced). Not safe,
 * not scalable, on purpose (mock-api.md). Later tasks add collections to `Db`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Schemas } from "@ifc-boq/api";
import { dataDir } from "./paths.js";

export type OrgRole = Schemas["OrgRole"];
export type UserRec = Schemas["User"];
export type OrgRec = Schemas["Org"];
export type PlanRec = Schemas["Plan"];
export interface MembershipRec {
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  lastActiveAt?: string;
}
export interface PresetRec {
  id: string;
  orgId: string | null;
  projectId: string | null;
  kind: Schemas["PresetKind"];
  layer: Schemas["PresetLayer"];
  slug: string;
  name: string;
  description?: string;
  basedOn?: string;
  available?: boolean;
  unavailableReason?: string;
  archived: boolean;
  updatedAt: string;
  updatedBy?: string;
}
export interface PresetVersionRec {
  id: string;
  presetId: string;
  number: number | null;
  status: "draft" | "published";
  doc: unknown;
  extendsVersionId: string | null;
  problems: string[];
  createdAt: string;
  publishedAt?: string;
}
export interface AuditRec {
  id: string;
  orgId: string | null;
  projectId?: string | null;
  actorId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  at: string;
  data?: Record<string, unknown>;
}

export interface Db {
  version: 1;
  seededAt: string;
  users: UserRec[];
  orgs: OrgRec[];
  memberships: MembershipRec[];
  plans: PlanRec[];
  presets: PresetRec[];
  presetVersions: PresetVersionRec[];
  audit: AuditRec[];
}

let state: Db | null = null;
let timer: NodeJS.Timeout | null = null;

const file = () => path.join(dataDir(), "db.json");

export function db(): Db {
  if (!state) throw new Error("store not loaded: call loadStore() or replaceStore() first");
  return state;
}

/** Loads `db.json`; returns false when there is none (the caller seeds). */
export function loadStore(): boolean {
  if (!existsSync(file())) return false;
  state = JSON.parse(readFileSync(file(), "utf8")) as Db;
  return true;
}

export function replaceStore(next: Db) {
  state = next;
  flush();
}

/** Schedules a write; every handler that changes state calls this. */
export function persist() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 200);
}

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!state) return;
  mkdirSync(dataDir(), { recursive: true });
  const tmp = `${file()}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 1));
  renameSync(tmp, file());
}

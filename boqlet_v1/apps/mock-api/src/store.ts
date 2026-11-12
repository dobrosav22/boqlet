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
export interface InvitationRec {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  invitedBy: string;
  createdAt: string;
  acceptedBy?: string;
}
export type ProjectRole = Schemas["ProjectRole"];
export interface ProjectRec {
  id: string;
  orgId: string;
  name: string;
  code?: string;
  client?: string;
  location?: { address?: string; country?: string };
  currency: string;
  unitSystem: "metric" | "imperial";
  locale: string;
  status: "active" | "archived";
  sample: boolean;
  defaults: Schemas["ProjectDefaults"];
  projectDictionaryId: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectMemberRec {
  projectId: string;
  userId: string;
  role: ProjectRole;
  addedBy?: string;
  createdAt: string;
}
export interface ModelRec {
  id: string;
  projectId: string;
  name: string;
  discipline: string;
  scope?: Record<string, unknown>;
  archived: boolean;
  createdAt: string;
}
export interface ModelVersionRec {
  id: string;
  modelId: string;
  number: number;
  fileName: string;
  sizeBytes: number;
  sha256?: string;
  status: Schemas["ModelVersionStatus"];
  parseJobId: string | null;
  summary?: Schemas["ModelSummary"];
  identicalToVersion: number | null;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  retryable?: boolean;
  note?: string;
  uploadedBy: string;
  uploadedAt: string;
  blobKey: string;
  /** The PoC engine's id for the parsed model (its sha256); phase 1 only. */
  engineModelId?: string;
  archived?: boolean;
}
export interface JobRec {
  id: string;
  type: string;
  status: Schemas["JobStatus"];
  progress?: { stage?: string; pct?: number; message?: string };
  subjectType: string;
  subjectId: string;
  projectId: string;
  orgId: string;
  createdBy: string;
  output?: Record<string, unknown>;
  error?: { code: string; message: string; retryable: boolean };
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}
export interface NotificationRec {
  id: string;
  userId: string;
  orgId: string | null;
  kind: string;
  params: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
  url: string;
  readAt: string | null;
  createdAt: string;
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
  invitations: InvitationRec[];
  projects: ProjectRec[];
  projectMembers: ProjectMemberRec[];
  models: ModelRec[];
  modelVersions: ModelVersionRec[];
  jobs: JobRec[];
  notifications: NotificationRec[];
  audit: AuditRec[];
  /** Orgs being deleted (F01 §9): hidden everywhere, removed later. */
  deletedOrgIds: string[];
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
  // Collections added after a db.json was written start empty.
  state.invitations ??= [];
  state.projects ??= [];
  state.projectMembers ??= [];
  state.models ??= [];
  state.modelVersions ??= [];
  state.jobs ??= [];
  state.notifications ??= [];
  state.deletedOrgIds ??= [];
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

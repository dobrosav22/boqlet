/**
 * The mock's state: one in-memory object, persisted to `<dataDir>/db.json` (debounced). Not safe,
 * not scalable, on purpose (mock-api.md). Later tasks add collections to `Db`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Schemas } from "@ifc-boq/api";
import type { Question } from "@ifc-boq/types";
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
  starred?: boolean;
  archived: boolean;
  createdAt?: string;
  createdBy?: string;
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
  createdBy?: string;
  /** Drafts: the last save (the ETag is built from it and `rev`). */
  updatedAt?: string;
  rev?: number;
  changeNote?: string;
  publishedAt?: string;
  publishedBy?: string;
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
/** A change report between two runs (F08 §3, the "Change report" fake): the body is kept gzipped in the blob folder. */
export interface DiffRec {
  id: string;
  fromRunId: string;
  toRunId: string;
  projectId: string;
  orgId: string;
  /** `RunDiff.summary` and `.questions`; lines and elements are in the blob at `key`. */
  summary: Record<string, unknown>;
  questions: { new: string[]; resolved: string[] };
  key: string;
  jobId: string;
  createdAt: string;
}
/** A public share link (F18): the token is kept only as its sha256 (BR-56). */
export interface ShareLinkRec {
  id: string;
  boqId: string;
  projectId: string;
  orgId: string;
  mode: "pinned" | "latest_issued";
  runId: string | null;
  include: { lineDetail: boolean; viewer: boolean; log: boolean; excel: boolean; groupBy?: string };
  label?: string;
  tokenHash: string;
  expiresAt: string | null;
  revokedAt?: string;
  views: number;
  lastViewedAt: string | null;
  createdBy: string;
  createdAt: string;
  /** The Excel a public visitor downloads, per run (written once). */
  exportKeys?: Record<string, string>;
}
/** A file made by an export job (F12): `Export` in the contract, with where it is kept. */
export interface ExportRec {
  id: string;
  kind: string;
  subjectType: "run" | "diff";
  subjectId: string;
  revisionId: string;
  projectId: string;
  orgId: string;
  fileName: string;
  storageKey: string;
  sizeBytes: number;
  jobId: string;
  createdBy: string;
  createdAt: string;
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
export type RevisionInputs = Schemas["RevisionInputs"];
export interface BoqRec {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: "working" | "confirmed";
  currentRevisionId: string;
  latestIssuedRevisionId: string | null;
  archived: boolean;
  /** F09 §5: who confirmed it, when (cleared on reopen). */
  confirmedBy?: string;
  confirmedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
/** A review comment (F09 §4): overall or on a line; approve and request changes leave one with their outcome. */
export interface ReviewCommentRec {
  id: string;
  by: string;
  at: string;
  text: string;
  lineKey?: string;
  outcome?: "approved" | "changes_requested";
}
export interface RevisionRec {
  id: string;
  boqId: string;
  number: number;
  status: Schemas["RevisionStatus"];
  inputs: RevisionInputs;
  currentRunId: string | null;
  basedOnRevisionId: string | null;
  createdAt: string;
  /** A working version closed by confirming a BoQ that had nothing new (F09 §5); reopening takes it up again. */
  closed?: boolean;
  /** A saved version's label when it isn't the default letter (F09 §2: editable, never reused, BR-26). */
  label?: string;
  // Review (F09 §4, approval on).
  reviewerIds?: string[];
  submittedBy?: string;
  submittedAt?: string;
  submitMessage?: string;
  approvedBy?: string;
  approvedAt?: string;
  comments?: ReviewCommentRec[];
  // Saved (F09 §2).
  issuedBy?: string;
  issuedAt?: string;
  issueNote?: string;
  openQuestionsAtSave?: number | null;
  /** What saving froze: the run, the BoQ's line edits and manual lines as they were, the Excel (BR-25). */
  frozen?: { runId: string; exportIds: string[]; adjustments: { overrides: OverrideRec[]; manualItems: ManualItemRec[] } };
}
export interface RunRec {
  id: string;
  revisionId: string;
  jobId: string;
  status: Schemas["RunStatus"];
  /**
   * What the run was asked for: the inputs as they were, the project dictionary appended, and the
   * project's decisions as they were sent (with the question each answers, F05 §1).
   */
  request: {
    inputs: RevisionInputs;
    projectDictionaryVersionId: string | null;
    decisions?: DecisionSnapshot[];
    /** The BoQ's line edits and manual lines as they were sent (F06 §6–7). */
    adjustments?: { overrides: OverrideRec[]; manualItems: ManualItemRec[] };
  };
  /** Ids of the questions the engine asked (the result's open questions), for pending changes. */
  askedQuestionIds?: string[];
  /** The blocking ones among them (project cards count those still unanswered). */
  blockingQuestionIds?: string[];
  stats?: Schemas["Run"]["stats"];
  models?: unknown[];
  building?: unknown;
  classifications?: { id: string; name: string }[];
  engineVersion?: string;
  error?: { code: string; message: string };
  /** Storage key of the full `BoqResult` (gzip). */
  resultKey?: string;
  createdBy: string;
  createdAt: string;
  finishedAt?: string;
}
/** An engine question, as a run's result holds it. */
export type QuestionRec = Question;
/** A decision as a run was generated with it. */
export interface DecisionSnapshot {
  questionId: string;
  kind: string;
  answer: string | number | boolean | null;
  question?: QuestionRec;
}
/**
 * A project decision (data-model.md "Decision"). A changed or cleared answer keeps its old row with
 * `supersededAt`; the API returns current rows only.
 */
export interface DecisionRec {
  id: string;
  projectId: string;
  questionId: string;
  kind: string;
  answer: string | number | boolean | null;
  note?: string;
  /** The question as last asked, when a run of the project asked it. */
  question?: QuestionRec;
  decidedBy: string;
  decidedAt: string;
  promotedToPresetVersionId: string | null;
  supersededAt?: string;
}
/** A line edit (data-model.md "LineOverride"): all edits of one line in one row, per BoQ. */
export interface OverrideRec {
  id: string;
  boqId: string;
  lineKey: string;
  quantity?: number | null;
  description?: string;
  unit?: string;
  codes?: Record<string, string>;
  sortAfter?: string | null;
  excluded?: boolean;
  reason?: string;
  createdBy: string;
  createdAt: string;
}
/** A manual line (data-model.md "ManualItem"): an engine manual item with its codes. */
export interface ManualItemRec {
  id: string;
  boqId: string;
  item: Record<string, unknown> & { id: string; kind: string; description: unknown; unit: string };
  codes?: Record<string, string>;
  sortHint?: string;
  createdBy: string;
  createdAt: string;
}
/** A sign-in's session (F01 §10, BR-54). */
export interface SessionRec {
  id: string;
  userId: string;
  status: "active" | "ended" | "replaced" | "expired";
  deviceLabel: string;
  place?: string;
  lastSeenAt: string;
  createdAt: string;
  endedAt?: string;
  replacedBy?: string;
}
/** Processing time used (BR-62), counted against `processingMinutesPerMonth`. */
export interface UsageRec {
  orgId: string;
  /** The project the job was for (the usage page's "by project", F14). */
  projectId?: string;
  kind: "parse" | "run" | "preview";
  ms: number;
  at: string;
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
  /** Missing: `user` when there is an actor, else `system`. */
  actorKind?: "platform_admin";
  action: string;
  subjectType: string;
  subjectId: string;
  at: string;
  data?: Record<string, unknown>;
}
/** A `402` (data-model.md "LimitEvent"): the admin console's "hit a limit" signal (F19). */
export interface LimitEventRec {
  id: string;
  orgId: string;
  userId?: string;
  limit: string;
  current: number;
  max: number;
  /** The operation that was refused (its operationId). */
  action: string;
  at: string;
}
/** A platform admin's note on an org (F19); never shown to the org. */
export interface AdminNoteRec {
  id: string;
  orgId: string;
  authorId: string;
  text: string;
  createdAt: string;
}
/** What the platform admin keeps on an org (F19) besides `Org.status`: never shown to the org. */
export interface OrgOpsRec {
  tags?: string[];
  /** Entitlement overrides on top of the plan (F14, F19). */
  overrides?: Record<string, unknown>;
  /** A trial set through the `manual` billing provider. */
  trialEndsAt?: string | null;
  planHistory?: { planId: string; at: string; by: string }[];
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
  boqs: BoqRec[];
  revisions: RevisionRec[];
  runs: RunRec[];
  decisions: DecisionRec[];
  overrides: OverrideRec[];
  manualItems: ManualItemRec[];
  exports: ExportRec[];
  diffs: DiffRec[];
  shareLinks: ShareLinkRec[];
  sessions: SessionRec[];
  usage: UsageRec[];
  notifications: NotificationRec[];
  /** Email choices per user and category (F13); missing = on. */
  notificationPreferences: Record<string, Record<string, boolean>>;
  audit: AuditRec[];
  limitEvents: LimitEventRec[];
  adminNotes: AdminNoteRec[];
  /** By org id. */
  orgOps: Record<string, OrgOpsRec>;
  /** When each person signed up (the User contract has no date), by user id. */
  userCreatedAt: Record<string, string>;
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
  state.boqs ??= [];
  state.revisions ??= [];
  state.runs ??= [];
  state.decisions ??= [];
  state.overrides ??= [];
  state.manualItems ??= [];
  state.exports ??= [];
  state.diffs ??= [];
  state.shareLinks ??= [];
  state.sessions ??= [];
  state.usage ??= [];
  state.notifications ??= [];
  state.notificationPreferences ??= {};
  state.deletedOrgIds ??= [];
  state.limitEvents ??= [];
  state.adminNotes ??= [];
  state.orgOps ??= {};
  state.userCreatedAt ??= {};
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

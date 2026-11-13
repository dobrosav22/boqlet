/**
 * Seed data (mock-api.md "Seed data"). FE-003 seeds the skeleton: plans, orgs, users,
 * memberships and every shipped preset in `presets/` as a system preset, version 1. Projects,
 * models, BoQs, org presets and the pricing plugin's data are added by the tasks that build them.
 *
 * Ids are stable (`seedId`), so tests and e2e can refer to seeded things on every machine.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { nowIso } from "./clock.js";
import { seedId } from "./ids.js";
import { PRESETS_DIR } from "./paths.js";
import { insertProject } from "./handlers/projects.js";
import type { Db, MembershipRec, OrgRec, PlanRec, PresetRec, PresetVersionRec, UserRec } from "./store.js";

/** Placeholder limits from 00-product/05-plans-and-limits.md. A missing limit means unlimited. */
export const PLANS: PlanRec[] = [
  {
    id: "free",
    name: "Free",
    entitlements: {
      seats: 2,
      activeProjects: 1,
      maxModelVersionMb: 50,
      maxModelsPerBoq: 2,
      processingMinutesPerMonth: 60,
      libraryOrgPresets: 1,
      auditLogRetentionDays: 30,
      approvalWorkflow: false,
      shareLinks: true,
      exportWatermark: true,
    },
  },
  {
    id: "professional",
    name: "Professional",
    entitlements: {
      seats: 5,
      activeProjects: 10,
      maxModelVersionMb: 300,
      maxModelsPerBoq: 6,
      processingMinutesPerMonth: 1000,
      auditLogRetentionDays: 365,
      approvalWorkflow: true,
      shareLinks: true,
      exportWatermark: false,
    },
  },
  {
    id: "team",
    name: "Team",
    entitlements: {
      seats: 25,
      activeProjects: 50,
      maxModelVersionMb: 300,
      maxModelsPerBoq: 12,
      processingMinutesPerMonth: 5000,
      auditLogRetentionDays: 365,
      approvalWorkflow: true,
      shareLinks: true,
      exportWatermark: false,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    entitlements: { approvalWorkflow: true, shareLinks: true, exportWatermark: false },
  },
];

export const SEED = {
  orgs: {
    studio: seedId("org:studio-demo"),
    small: seedId("org:small-firm"),
  },
  users: {
    olivia: seedId("user:olivia"),
    ivana: seedId("user:ivana"),
    marko: seedId("user:marko"),
    ana: seedId("user:ana"),
    victor: seedId("user:victor"),
    pat: seedId("user:pat"),
  },
} as const;

const user = (key: keyof typeof SEED.users, name: string, extra: Partial<UserRec> = {}): UserRec => ({
  id: SEED.users[key],
  email: `${key}@example.com`,
  name,
  locale: "en",
  ...extra,
});

export function buildSeed(): Db {
  const at = nowIso();
  const orgSettings = {
    fourEyes: false,
    defaultLocale: "en",
    defaultCurrency: "EUR",
    defaultUnitSystem: "metric" as const,
    publicLinksAllowed: true,
    approvalRequired: false,
    defaultLanguage: "en",
  };
  const orgs: OrgRec[] = [
    {
      id: SEED.orgs.studio,
      name: "Studio Demo",
      slug: "studio-demo",
      planId: "team",
      settings: orgSettings,
      setup: { status: "done", step: "review", updatedAt: at, completedAt: at },
      createdAt: at,
    },
    {
      id: SEED.orgs.small,
      name: "Small Firm",
      slug: "small-firm",
      planId: "free",
      settings: orgSettings,
      setup: { status: "done", step: "review", updatedAt: at, completedAt: at },
      createdAt: at,
    },
  ];
  const users: UserRec[] = [
    user("olivia", "Olivia Owner"),
    user("ivana", "Ivana Library"),
    user("marko", "Marko Estimator"),
    user("ana", "Ana Approver"),
    user("victor", "Victor Viewer"),
    user("pat", "Pat Platform", { platformRole: "admin" }),
  ];
  const member = (org: keyof typeof SEED.orgs, u: keyof typeof SEED.users, role: MembershipRec["role"]): MembershipRec => ({
    orgId: SEED.orgs[org],
    userId: SEED.users[u],
    role,
    createdAt: at,
  });
  // Project roles (estimator, approver, viewer) are given per project when projects are seeded (FE-006).
  const memberships: MembershipRec[] = [
    member("studio", "olivia", "owner"),
    member("studio", "ivana", "library_editor"),
    member("studio", "marko", "member"),
    member("studio", "ana", "member"),
    member("studio", "victor", "member"),
    member("small", "olivia", "owner"),
  ];
  const { presets, presetVersions } = systemPresets(at);
  orgPresets(presets, presetVersions, at);
  const store: Db = { version: 1, seededAt: at, users, orgs, memberships, plans: PLANS, presets, presetVersions, invitations: [], projects: [], projectMembers: [], models: [], modelVersions: [], jobs: [], boqs: [], revisions: [], runs: [], decisions: [], overrides: [], manualItems: [], exports: [], diffs: [], sessions: [], usage: [], notifications: [], notificationPreferences: {}, audit: [], deletedOrgIds: [] };
  seedProjects(store, at);
  // mock-api.md "Seed data": Marko is signed in elsewhere, so the takeover screen can be tried.
  store.sessions.push({ id: seedId("session:marko"), userId: SEED.users.marko, status: "active", deviceLabel: "Firefox on macOS", place: "Amsterdam", lastSeenAt: at, createdAt: at });
  return store;
}

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;

/** Every shipped preset as a system-layer preset with a published version 1. */
export function systemPresets(at: string) {
  const presets: PresetRec[] = [];
  const presetVersions: PresetVersionRec[] = [];
  const add = (kind: PresetRec["kind"], slug: string, name: string, doc: unknown, extra: Partial<PresetRec> = {}, extendsSlug?: string) => {
    const id = seedId(`preset:${kind}:${slug}`);
    presets.push({ id, orgId: null, projectId: null, kind, layer: "system", slug, name, archived: false, updatedAt: at, ...extra });
    presetVersions.push({
      id: seedId(`preset-version:${kind}:${slug}:1`),
      presetId: id,
      number: 1,
      status: "published",
      doc,
      extendsVersionId: extendsSlug ? seedId(`preset-version:${kind}:${extendsSlug}:1`) : null,
      problems: [],
      createdAt: at,
      publishedAt: at,
    });
  };

  const dir = (name: string) => path.join(PRESETS_DIR, name);
  for (const file of readdirSync(dir("rules")).filter((f) => f.endsWith(".json")).sort()) {
    const doc = readJson(path.join(dir("rules"), file));
    const description = (doc.meta as { description?: string } | undefined)?.description;
    add("rule_set", String(doc.id), String(doc.name), doc, description ? { description, basedOn: doc.extends as string | undefined } : {}, doc.extends as string | undefined);
  }
  for (const file of readdirSync(dir("dictionaries")).filter((f) => f.endsWith(".json")).sort()) {
    const doc = readJson(path.join(dir("dictionaries"), file));
    add("dictionary", String(doc.id), String(doc.name), doc);
  }
  for (const folder of readdirSync(dir("classifications")).sort()) {
    const base = path.join(dir("classifications"), folder);
    const map = readJson(path.join(base, "map.json"));
    const codeListFile = path.join(base, "codelist.json");
    const codeList = existsSync(codeListFile) ? readJson(codeListFile) : null;
    const name = String(codeList?.name ?? map.name ?? folder);
    add(
      "classification",
      folder,
      name,
      { codeList, map },
      codeList ? { available: true } : { available: false, unavailableReason: "code_list_not_downloaded" },
    );
  }
  const federation = readJson(path.join(dir("settings"), "federation.json"));
  add("federation", String(federation.id ?? "federation-default"), String(federation.name ?? "Federation"), federation);
  const resolution = readJson(path.join(dir("settings"), "resolution.json"));
  add("resolution", String(resolution.id ?? "resolution-default"), String(resolution.name ?? "Default resolution settings"), resolution);
  return { presets, presetVersions };
}

export const SEED_PRESETS = {
  studioRules: seedId("preset:org:studio-rules"),
  studioTrades: seedId("preset:org:studio-trades"),
  studioNames: seedId("preset:org:studio-names"),
} as const;

/**
 * Studio Demo's own Library (mock-api.md "Seed data"): "Studio rules", a patch on As modelled with
 * three settings changed, version 1 published and a draft; "Studio trades", a copy of demo-trades;
 * "Studio names", a copy of acme-company. Written by Ivana, the library editor.
 */
function orgPresets(presets: PresetRec[], presetVersions: PresetVersionRec[], at: string) {
  const ivana = SEED.users.ivana;
  const systemVersion = (kind: PresetRec["kind"], slug: string) => presetVersions.find((v) => v.id === seedId(`preset-version:${kind}:${slug}:1`))!;
  const add = (key: keyof typeof SEED_PRESETS, kind: PresetRec["kind"], slug: string, name: string, doc: unknown, extendsVersionId: string | null, extra: Partial<PresetRec> = {}) => {
    const id = SEED_PRESETS[key];
    presets.push({ id, orgId: SEED.orgs.studio, projectId: null, kind, layer: "org", slug, name, archived: false, createdAt: at, createdBy: ivana, updatedAt: at, updatedBy: ivana, ...extra });
    presetVersions.push({ id: seedId(`preset-version:org:${slug}:1`), presetId: id, number: 1, status: "published", doc, extendsVersionId, problems: [], createdAt: at, createdBy: ivana, changeNote: "First version", publishedAt: at, publishedBy: ivana });
  };
  const rules = {
    schemaVersion: "1.0",
    id: "studio-rules",
    name: "Studio rules",
    version: "1",
    extends: "as-modelled",
    meta: {},
    params: { wall_opening_mode: { value: "over_threshold" }, wall_opening_threshold: { value: 0.5 }, window_measure: { value: "area" } },
  };
  add("studioRules", "rule_set", "studio-rules", "Studio rules", rules, systemVersion("rule_set", "as-modelled").id, { basedOn: "As modelled", description: "Our office settings on As modelled." });
  presetVersions.push({
    id: seedId("preset-version:org:studio-rules:draft"),
    presetId: SEED_PRESETS.studioRules,
    number: null,
    status: "draft",
    doc: { ...rules, params: { ...rules.params, lines_by_storey: { value: true } } },
    extendsVersionId: systemVersion("rule_set", "as-modelled").id,
    problems: [],
    createdAt: at,
    createdBy: ivana,
    updatedAt: at,
    rev: 0,
  });
  const trades = structuredClone(systemVersion("classification", "demo-trades").doc) as { codeList: Record<string, unknown>; map: Record<string, unknown> };
  trades.codeList = { ...trades.codeList, id: "studio-trades", name: "Studio trades" };
  trades.map = { ...trades.map, id: "studio-trades-map", name: "Studio trades: map", codeList: "studio-trades" };
  add("studioTrades", "classification", "studio-trades", "Studio trades", trades, null, { available: true });
  const names = { ...(structuredClone(systemVersion("dictionary", "acme-company").doc) as Record<string, unknown>), id: "studio-names", name: "Studio names" };
  add("studioNames", "dictionary", "studio-names", "Studio names", names, null);
}

/**
 * Projects (mock-api.md "Seed data"): Duplex with its team, an empty project, and Small Firm at its
 * one-project limit. Models, BoQs and the federated Office project come with FE-007 and FE-008.
 */
export const SEED_PROJECTS = {
  duplex: seedId("project:duplex"),
  empty: seedId("project:empty"),
  smallHouse: seedId("project:small-house"),
} as const;

function seedProjects(store: Db, at: string) {
  const org = (id: string) => store.orgs.find((o) => o.id === id)!;
  const person = (id: string) => store.users.find((u) => u.id === id)!;
  insertProject(org(SEED.orgs.studio), person(SEED.users.olivia), { name: "Duplex", code: "DPX-01", client: "NIBS sample", location: { country: "US" } }, { at, id: SEED_PROJECTS.duplex, store });
  store.projectMembers.push(
    { projectId: SEED_PROJECTS.duplex, userId: SEED.users.marko, role: "estimator", addedBy: SEED.users.olivia, createdAt: at },
    { projectId: SEED_PROJECTS.duplex, userId: SEED.users.ana, role: "approver", addedBy: SEED.users.olivia, createdAt: at },
    { projectId: SEED_PROJECTS.duplex, userId: SEED.users.victor, role: "viewer", addedBy: SEED.users.olivia, createdAt: at },
  );
  insertProject(org(SEED.orgs.studio), person(SEED.users.olivia), { name: "Empty project" }, { at, id: SEED_PROJECTS.empty, store });
  insertProject(org(SEED.orgs.small), person(SEED.users.olivia), { name: "Small Firm house" }, { at, id: SEED_PROJECTS.smallHouse, store });
}

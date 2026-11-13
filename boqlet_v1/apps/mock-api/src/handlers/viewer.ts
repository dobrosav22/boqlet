/**
 * F07 viewer data (FE-016): a model version's display geometry and scene index (from the engine,
 * kept in the blob folder once fetched), and a run's per-element view: which lines an element feeds
 * and the coverage status of every element. Nothing is measured here: it reads the run's stored
 * result and the scene index (BR-01).
 */
import type { BoqLine, BoqResult, SceneIndex } from "@ifc-boq/types";
import { blobExists, getBlob, putBlob, signedUrl } from "../blobs.js";
import { engine, EngineRefused, EngineUnavailable } from "../engine/engine.js";
import { conflict, HttpError, notFound } from "../http.js";
import { json, type Handlers } from "../router.js";
import { db, type ModelVersionRec, type RunRec } from "../store.js";
import { runFor, runResult } from "./lines.js";
import { versionOf } from "./models.js";

const geometryKey = (orgId: string, v: ModelVersionRec) => `orgs/${orgId}/model-versions/${v.id}/geometry.glb`;
const sceneKey = (orgId: string, v: ModelVersionRec) => `orgs/${orgId}/model-versions/${v.id}/scene.json`;

function orgOfVersion(v: ModelVersionRec) {
  const model = db().models.find((m) => m.id === v.modelId)!;
  return db().projects.find((p) => p.id === model.projectId)!.orgId;
}

async function fromEngine<T>(fetch: () => Promise<T>): Promise<T> {
  try {
    return await fetch();
  } catch (e) {
    if (e instanceof EngineUnavailable) throw new HttpError(503, "engine_unavailable", "The engine is not reachable.");
    if (e instanceof EngineRefused && e.status === 404) throw notFound("geometry");
    throw e;
  }
}

function readyEngineId(v: ModelVersionRec) {
  if (v.status !== "ready" || !v.engineModelId) throw conflict("model_not_ready", "The model version is not ready yet.");
  return v.engineModelId;
}

/** The scene index of a version, fetched from the engine once and kept (immutable per version). */
const scenes = new Map<string, SceneIndex>();
export async function sceneOf(v: ModelVersionRec): Promise<SceneIndex> {
  const hit = scenes.get(v.id);
  if (hit) return hit;
  const key = sceneKey(orgOfVersion(v), v);
  let scene: SceneIndex;
  if (await blobExists(key)) scene = JSON.parse((await getBlob(key)).toString("utf8")) as SceneIndex;
  else {
    const engineId = readyEngineId(v);
    scene = await fromEngine(() => engine().scene(engineId));
    await putBlob(key, new TextEncoder().encode(JSON.stringify(scene)));
  }
  scenes.set(v.id, scene);
  return scene;
}

/* ------------------------------------------------------------------ links (the PoC's links.ts) */

interface RunView {
  result: BoqResult;
  /** Elements of every model version of the run, by GlobalId. */
  elements: Map<string, SceneIndex["elements"][string] & { modelVersionId: string }>;
  spaces: Set<string>;
  openings: Set<string>;
  /** Lines by the elements they measure (derived per-line lines take their source line's elements). */
  linesOf: Map<string, { line: BoqLine; share: number | null }[]>;
  coverage: { measured: string[]; excluded: string[]; unmatched: string[]; coveredByParent: string[] };
  statusOf: Map<string, "measured" | "excluded" | "unmatched" | "covered_by_parent">;
}

const views = new Map<string, RunView>();

async function runView(run: RunRec): Promise<RunView> {
  const hit = views.get(run.id);
  if (hit) return hit;
  const result = await runResult(run);
  const elements: RunView["elements"] = new Map();
  const spaces = new Set<string>();
  const openings = new Set<string>();
  for (const input of run.request.inputs.models) {
    const version = db().modelVersions.find((v) => v.id === input.modelVersionId);
    if (!version) continue;
    const scene = await sceneOf(version);
    for (const [guid, e] of Object.entries(scene.elements)) if (!elements.has(guid)) elements.set(guid, { ...e, modelVersionId: version.id });
    scene.spaces.forEach((g) => spaces.add(g));
    scene.openings.forEach((g) => openings.add(g));
  }

  const byKey = new Map(result.lines.map((l) => [l.key, l]));
  const elementsOf = (line: BoqLine, depth = 0): Map<string, number | null> => {
    const out = new Map<string, number | null>();
    for (const e of line.trace.elements) {
      if (!e.guid) continue;
      const before = out.get(e.guid);
      out.set(e.guid, e.quantity === null ? (before ?? null) : (before ?? 0) + e.quantity);
    }
    if (!out.size && line.trace.sourceLine && depth < 5) {
      const src = byKey.get(line.trace.sourceLine);
      if (src) for (const g of elementsOf(src, depth + 1).keys()) out.set(g, null);
    }
    return out;
  };
  const linesOf: RunView["linesOf"] = new Map();
  for (const line of result.lines)
    for (const [guid, share] of elementsOf(line)) linesOf.set(guid, [...(linesOf.get(guid) ?? []), { line, share }]);

  const unmatched = new Set(result.questions.filter((q) => q.kind === "unmatched").flatMap((q) => q.guids ?? []));
  const statusOf: RunView["statusOf"] = new Map();
  const measuredUp = (guid: string) => {
    for (let g = elements.get(guid)?.parent, n = 0; g && n < 10; g = elements.get(g)?.parent, n++) if (linesOf.has(g)) return true;
    return false;
  };
  for (const guid of elements.keys()) {
    if (spaces.has(guid) || openings.has(guid)) continue;
    statusOf.set(guid, linesOf.has(guid) ? "measured" : unmatched.has(guid) ? "unmatched" : measuredUp(guid) ? "covered_by_parent" : "excluded");
  }
  for (const guid of unmatched) if (!statusOf.has(guid)) statusOf.set(guid, "unmatched");
  const coverage: RunView["coverage"] = { measured: [], excluded: [], unmatched: [], coveredByParent: [] };
  const field = { measured: "measured", excluded: "excluded", unmatched: "unmatched", covered_by_parent: "coveredByParent" } as const;
  for (const [guid, status] of statusOf) coverage[field[status]].push(guid);

  const view = { result, elements, spaces, openings, linesOf, coverage, statusOf };
  views.set(run.id, view);
  if (views.size > 4) views.delete(views.keys().next().value!);
  return view;
}

export const viewerHandlers: Handlers = {
  async getModelGeometry({ user, params }) {
    const { version, project } = versionOf(user!, params.versionId!);
    const key = geometryKey(project.orgId, version);
    if (!(await blobExists(key))) {
      const engineId = readyEngineId(version);
      await putBlob(key, await fromEngine(() => engine().geometry(engineId)));
    }
    // The URL stays the same for a day, so the browser's cache holds the geometry (F07 §1: immutable).
    return new Response(null, { status: 302, headers: { Location: signedUrl(key, "GET", 86_400, { stable: true }).url } });
  },

  async getModelScene({ user, params }) {
    const { version } = versionOf(user!, params.versionId!);
    return json(await sceneOf(version));
  },

  async getElementLines({ user, params }) {
    const run = runFor(user!, params.runId!);
    const view = await runView(run);
    const guid = params.guid!;
    const element = view.elements.get(guid);
    if (!element && !view.linesOf.has(guid)) throw notFound("element");
    // The element's own lines, then those that measure its aggregate parents (a roof's slab, F07 §4).
    const rows: { line: BoqLine; share: number | null }[] = [];
    for (let g: string | undefined = guid, n = 0; g && n < 10; g = view.elements.get(g)?.parent, n++)
      for (const r of view.linesOf.get(g) ?? []) if (!rows.some((x) => x.line.key === r.line.key)) rows.push(g === guid ? r : { line: r.line, share: null });
    const status = view.statusOf.get(guid);
    return json({
      guid,
      ...(element
        ? {
            modelVersionId: element.modelVersionId,
            ifcClass: element.ifcClass,
            ...(element.name ? { name: element.name } : {}),
            ...(element.type ? { type: element.type } : {}),
            ...(element.storey ? { storey: element.storey } : {}),
          }
        : {}),
      ...(status ? { status } : {}),
      lines: rows.map(({ line, share }) => ({ lineKey: line.key, description: line.description, unit: line.unit, quantity: share })),
    });
  },

  async getCoverage({ user, params }) {
    const run = runFor(user!, params.runId!);
    return json((await runView(run)).coverage);
  },
};

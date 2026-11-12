/**
 * F06 sheet data (FE-009): a run's lines (all at once, or grouped server-side for large runs),
 * one line with its log, the warnings and the paged log. The mock keeps no rows: it reads the run's
 * stored `BoqResult` (mock-api.md "Ingestion": arrays per run, paging and filters in memory).
 */
import { gunzipSync } from "node:zlib";
import type { BoqLine, BoqResult, LogEntry } from "@ifc-boq/types";
import { getBlob } from "../blobs.js";
import { HttpError, notFound } from "../http.js";
import { visibleProject } from "../projects.js";
import { json, type Handlers } from "../router.js";
import { db, type RunRec, type UserRec } from "../store.js";

/** Results are immutable once written, so they are cached by run id (a few, most recent). */
const cache = new Map<string, BoqResult>();
const CACHE_SIZE = 8;

export async function runResult(run: RunRec): Promise<BoqResult> {
  const hit = cache.get(run.id);
  if (hit) return hit;
  if (!run.resultKey) throw new HttpError(409, "run_not_finished", "The run has no result yet.", { status: run.status });
  const result = JSON.parse(gunzipSync(await getBlob(run.resultKey)).toString("utf8")) as BoqResult;
  cache.set(run.id, result);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return result;
}

function runFor(user: UserRec, runId: string) {
  const run = db().runs.find((r) => r.id === runId);
  if (!run) throw notFound("run");
  const revision = db().revisions.find((r) => r.id === run.revisionId)!;
  const boq = db().boqs.find((b) => b.id === revision.boqId)!;
  visibleProject(user, boq.projectId);
  return run;
}

/** A line as the contract's `RunLine`: the engine's line plus its place in the run. */
const runLine = (line: BoqLine, sortIndex: number) => ({ ...line, sortIndex });

/** Names a model can be filtered by: our model id, its name, or the engine's id for its version. */
function modelAliases(run: RunRec, modelId: string): Set<string> {
  const out = new Set([modelId]);
  const model = db().models.find((m) => m.id === modelId);
  if (model) out.add(model.name);
  const input = run.request.inputs.models.find((m) => m.modelId === modelId);
  const engineId = input && db().modelVersions.find((v) => v.id === input.modelVersionId)?.engineModelId;
  if (engineId) out.add(engineId);
  return out;
}

const pathOf = (line: BoqLine, system: string) => (line.codes[system]?.path ?? []).map((p) => p.code);

function filterLines(run: RunRec, lines: BoqLine[], query: Record<string, unknown>) {
  const source = query.source as string | undefined;
  const storey = query.storey as string | undefined;
  const family = query.family as string | undefined;
  const q = String(query.q ?? "").trim().toLowerCase();
  const models = query.modelId ? modelAliases(run, String(query.modelId)) : null;
  return lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => {
      if (source && line.source !== source) return false; // "overridden" matches nothing until line edits (FE-011)
      if (storey && line.location?.storey !== storey && !line.location?.storeys?.includes(storey)) return false;
      if (family && line.family !== family) return false;
      if (models && !line.trace.elements.some((e) => e.model && models.has(e.model))) return false;
      if (q && !line.description.toLowerCase().includes(q) && !Object.values(line.codes).some((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))) return false;
      return true;
    });
}

const page = <T>(items: T[], query: Record<string, unknown>, fallback: number, max: number) => {
  const start = query.cursor ? Number.parseInt(String(query.cursor), 10) : 0;
  if (!Number.isInteger(start) || start < 0) throw new HttpError(400, "invalid_param", "Bad cursor.");
  const limit = Math.min(Number(query.limit ?? fallback), max);
  const slice = items.slice(start, start + limit);
  return { slice, nextCursor: start + limit < items.length ? String(start + limit) : null };
};

export const lineHandlers: Handlers = {
  async listLines({ user, params, query }) {
    const run = runFor(user!, params.runId!);
    const result = await runResult(run);
    const filtered = filterLines(run, result.lines, query);
    const groupBy = query.groupBy as string | undefined;
    if (groupBy && query.level !== undefined) {
      // Server-side grouping (large runs, F06 edge cases): group rows at `level`, lines of one group on request.
      const level = Number(query.level);
      const prefix = query.groupPath ? String(query.groupPath).split("/") : [];
      const groups = new Map<string, { path: string; code: string; title: string; lineCount: number; units: Set<string>; quantity: number }>();
      for (const { line } of filtered) {
        const codes = line.codes[groupBy]?.path ?? [];
        const key = codes.slice(0, level).map((p) => p.code);
        const path = key.length ? key.join("/") : "";
        const last = codes[Math.min(level, codes.length) - 1];
        const g = groups.get(path) ?? { path, code: last?.code ?? "", title: last?.title ?? "", lineCount: 0, units: new Set<string>(), quantity: 0 };
        g.lineCount += 1;
        g.units.add(line.unit);
        g.quantity += line.quantity ?? 0;
        groups.set(path, g);
      }
      const inGroup = prefix.length ? filtered.filter(({ line }) => pathOf(line, groupBy).slice(0, prefix.length).join("/") === prefix.join("/")) : [];
      const { slice, nextCursor } = page(inGroup, query, 5000, 20000);
      return json({
        items: slice.map(({ line, i }) => runLine(line, i)),
        groups: [...groups.values()].map((g) => ({
          path: g.path,
          code: g.code,
          title: g.title,
          lineCount: g.lineCount,
          unit: g.units.size === 1 ? [...g.units][0]! : null,
          quantity: g.units.size === 1 ? g.quantity : null,
        })),
        total: filtered.length,
        nextCursor,
      });
    }
    const { slice, nextCursor } = page(filtered, query, 5000, 20000);
    return json({ items: slice.map(({ line, i }) => runLine(line, i)), total: filtered.length, nextCursor });
  },

  async getLine({ user, params, query }) {
    const run = runFor(user!, params.runId!);
    const result = await runResult(run);
    const index = result.lines.findIndex((l) => l.key === query.key);
    if (index < 0) throw notFound("line");
    const line = result.lines[index]!;
    return json({ ...runLine(line, index), log: result.log.filter((e) => e.lineKey === line.key) });
  },

  async listWarnings({ user, params }) {
    const run = runFor(user!, params.runId!);
    return json((await runResult(run)).warnings);
  },

  async listLog({ user, params, query }) {
    const run = runFor(user!, params.runId!);
    const log = (await runResult(run)).log.filter(
      (e: LogEntry) =>
        (!query.stage || e.stage === query.stage) &&
        (!query.level || e.level === query.level) &&
        (!query.ruleId || e.ruleId === query.ruleId) &&
        (!query.lineKey || e.lineKey === query.lineKey) &&
        (!query.guid || e.guid === query.guid),
    );
    const { slice, nextCursor } = page(log, query, 100, 1000);
    return json({ items: slice, nextCursor });
  },
};

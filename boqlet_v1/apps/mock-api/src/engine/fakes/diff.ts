/**
 * Fake "change report" (mock-api.md, replaced by EN-002): compares two runs' stored results, lines by
 * line key and elements by GlobalId per model, with plain comparisons (nothing is measured, BR-01).
 *
 * - Lines: excluded lines (F06 §6) count as not in the BoQ. A line is changed when its quantity, unit
 *   or description differs.
 * - Elements: two runs on the same model version have no element changes (versions are immutable,
 *   BR-08). Different versions are compared through their scene indexes (class, type, name, storey)
 *   and the elements' shares in the lines (`quantities`). A model in one run only: all its elements
 *   added or removed.
 * - Causes: `elements_*` from the element changes of a line's elements, `override_changed` when the
 *   line's edit differs, `rules_changed` when the rule set differs (and for a line whose elements were
 *   measured on both sides but under another key), `decision_changed` when an answer the line's
 *   elements were asked about differs (or, for a line nothing else explains, when any answer differs).
 *
 * Known gaps until EN-002: no material comparison, causes are inferred, not traced.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BoqLine, BoqResult, SceneIndex } from "@ifc-boq/types";
import { PRODUCT_ROOT } from "../../paths.js";
import type { EditedLine } from "./line-edits.js";

export type Cause = "elements_added" | "elements_removed" | "elements_changed" | "rules_changed" | "decision_changed" | "override_changed";

export interface DiffSide {
  result: BoqResult;
  request: {
    inputs: {
      models: { modelId: string; modelVersionId: string }[];
      ruleSetVersionId: string | null;
      classificationVersionIds: string[];
      dictionaryVersionIds: string[];
      federationVersionId?: string | null;
      resolutionVersionId?: string | null;
    };
    projectDictionaryVersionId?: string | null;
    decisions?: { questionId: string; answer: unknown; question?: { guids?: string[] } }[];
    adjustments?: { overrides: { lineKey: string }[]; manualItems: { item: { id: string } }[] };
  };
  askedQuestionIds: string[];
  /** Each model of the run: its name and its version's scene index (only needed when versions differ). */
  models: { modelId: string; name: string; versionId: string; scene?: SceneIndex }[];
}

export interface LineChange {
  lineKey: string;
  change: "added" | "removed" | "changed";
  before?: { quantity: number | null; unit: string; description: string; codes: BoqLine["codes"] };
  after?: { quantity: number | null; unit: string; description: string; codes: BoqLine["codes"] };
  delta: number | null;
  deltaPct: number | null;
  causes: Cause[];
}

export interface ElementChange {
  guid: string;
  model: string;
  change: "added" | "removed" | "changed";
  fields: string[];
  lineKeys: string[];
}

export interface DiffResult {
  summary: {
    linesAdded: number;
    linesRemoved: number;
    linesChanged: number;
    linesUnchanged: number;
    elementsAdded: number;
    elementsRemoved: number;
    elementsChanged: number;
    questionsNew: number;
    questionsResolved: number;
    guidChurnWarning: boolean;
    inputsChanged: string[];
    /** Per model (by name): elements added, removed, changed (F08 §4 "per model"). */
    byModel: { model: string; added: number; removed: number; changed: number }[];
  };
  questions: { new: string[]; resolved: string[] };
  lines: LineChange[];
  elements: ElementChange[];
}

const EPS = 1e-9;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const round = (n: number) => Math.round(n * 1e6) / 1e6;

const inBoq = (r: BoqResult) => (r.lines as EditedLine[]).filter((l) => !l.excluded);

/** Element → its total share per line key, from the lines' traces. */
function sharesOf(lines: BoqLine[]) {
  const out = new Map<string, Map<string, number>>();
  for (const line of lines)
    for (const e of line.trace.elements) {
      const m = out.get(e.guid) ?? new Map<string, number>();
      m.set(line.key, (m.get(line.key) ?? 0) + (e.quantity ?? 0));
      out.set(e.guid, m);
    }
  return out;
}

const overrideKey = (side: DiffSide) =>
  new Map((side.request.adjustments?.overrides ?? []).map((o) => {
    const { lineKey, ...rest } = o as { lineKey: string } & Record<string, unknown>;
    const { id: _i, createdAt: _c, createdBy: _b, updatedAt: _u, updatedBy: _ub, boqId: _bq, ...content } = rest;
    return [lineKey, JSON.stringify(content)];
  }));

/** Which inputs differ between the two runs' requests (the keys of `pendingChanges`). */
export function inputsChanged(from: DiffSide["request"], to: DiffSide["request"]) {
  const models = (r: DiffSide["request"]) => r.inputs.models.map((m) => `${m.modelId}:${m.modelVersionId}`).sort();
  const out: string[] = [];
  if (!same(models(from), models(to))) out.push("inputs.models");
  if (from.inputs.ruleSetVersionId !== to.inputs.ruleSetVersionId) out.push("inputs.ruleSet");
  if (!same(from.inputs.classificationVersionIds, to.inputs.classificationVersionIds)) out.push("inputs.classifications");
  if (!same(from.inputs.dictionaryVersionIds, to.inputs.dictionaryVersionIds) || (from.projectDictionaryVersionId ?? null) !== (to.projectDictionaryVersionId ?? null)) out.push("inputs.dictionaries");
  if ((from.inputs.federationVersionId ?? null) !== (to.inputs.federationVersionId ?? null)) out.push("inputs.federation");
  if ((from.inputs.resolutionVersionId ?? null) !== (to.inputs.resolutionVersionId ?? null)) out.push("inputs.resolution");
  const answers = (r: DiffSide["request"]) => (r.decisions ?? []).map((d) => [d.questionId, d.answer]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (!same(answers(from), answers(to))) out.push("decisions");
  const edits = (s: DiffSide["request"]) => {
    const ov = overrideKey({ request: s } as DiffSide);
    return [[...ov.entries()].sort(), (s.adjustments?.manualItems ?? []).map((m) => JSON.stringify(m.item)).sort()];
  };
  if (!same(edits(from), edits(to))) out.push("adjustments");
  return out;
}

/** GlobalIds of the elements an answer was about, for the answers that differ; `any` when one had none. */
function changedDecisionGuids(from: DiffSide, to: DiffSide) {
  const a = new Map((from.request.decisions ?? []).map((d) => [d.questionId, d]));
  const b = new Map((to.request.decisions ?? []).map((d) => [d.questionId, d]));
  const guids = new Set<string>();
  let any = false;
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(id);
    const y = b.get(id);
    if (same(x?.answer, y?.answer)) continue;
    any = true;
    for (const g of [...(x?.question?.guids ?? []), ...(y?.question?.guids ?? [])]) guids.add(g);
  }
  return { guids, any };
}

/** Element changes per model (F08 §4–5): GlobalIds matched within a model. */
function elementChanges(from: DiffSide, to: DiffSide, fromShares: Map<string, Map<string, number>>, toShares: Map<string, Map<string, number>>) {
  const out: ElementChange[] = [];
  let churn = false;
  const modelIds = new Set([...from.models.map((m) => m.modelId), ...to.models.map((m) => m.modelId)]);
  const keysOf = (guid: string) => [...new Set([...(fromShares.get(guid)?.keys() ?? []), ...(toShares.get(guid)?.keys() ?? [])])].sort();
  for (const modelId of modelIds) {
    const a = from.models.find((m) => m.modelId === modelId);
    const b = to.models.find((m) => m.modelId === modelId);
    if (a && b && a.versionId === b.versionId) continue;
    const name = (b ?? a)!.name;
    const before = a?.scene?.elements ?? {};
    const after = b?.scene?.elements ?? {};
    let added = 0;
    let removed = 0;
    for (const [guid, e] of Object.entries(after)) {
      if (a && before[guid]) {
        const was = before[guid]!;
        const fields: string[] = [];
        if (was.ifcClass !== e.ifcClass) fields.push("class");
        if ((was.type ?? null) !== (e.type ?? null)) fields.push("type");
        if ((was.name ?? null) !== (e.name ?? null)) fields.push("name");
        if ((was.storey ?? null) !== (e.storey ?? null)) fields.push("storey");
        const s1 = fromShares.get(guid);
        const s2 = toShares.get(guid);
        const shares = (s?: Map<string, number>) => [...(s?.entries() ?? [])].map(([k, v]) => [k, round(v)]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
        if (!same(shares(s1), shares(s2))) fields.push("quantities");
        if (fields.length) out.push({ guid, model: name, change: "changed", fields, lineKeys: keysOf(guid) });
      } else {
        added++;
        out.push({ guid, model: name, change: "added", fields: [], lineKeys: keysOf(guid) });
      }
    }
    for (const guid of Object.keys(before))
      if (!b || !after[guid]) {
        removed++;
        out.push({ guid, model: name, change: "removed", fields: [], lineKeys: keysOf(guid) });
      }
    // F08 edge case: GlobalIds regenerated by the authoring tool.
    if (a && b && Object.keys(before).length && removed / Object.keys(before).length > 0.5 && added / Math.max(Object.keys(after).length, 1) > 0.5) churn = true;
  }
  return { elements: out, churn };
}

/** Compares run `from` (older) with run `to`. */
export function diffRuns(from: DiffSide, to: DiffSide): DiffResult {
  const before = new Map(inBoq(from.result).map((l) => [l.key, l]));
  const after = new Map(inBoq(to.result).map((l) => [l.key, l]));
  const fromShares = sharesOf([...before.values()]);
  const toShares = sharesOf([...after.values()]);
  const { elements, churn } = elementChanges(from, to, fromShares, toShares);
  const changeOf = new Map(elements.map((e) => [e.guid, e.change]));
  const rulesDiffer = from.request.inputs.ruleSetVersionId !== to.request.inputs.ruleSetVersionId;
  const decisions = changedDecisionGuids(from, to);
  const ovFrom = overrideKey(from);
  const ovTo = overrideKey(to);
  const measuredBefore = new Set(fromShares.keys());
  const measuredAfter = new Set(toShares.keys());

  const lines: LineChange[] = [];
  let unchanged = 0;
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(key);
    const b = after.get(key);
    const change = !a ? "added" : !b ? "removed" : null;
    const differs = a && b && (a.unit !== b.unit || a.description !== b.description || (a.quantity === null) !== (b.quantity === null) || Math.abs((a.quantity ?? 0) - (b.quantity ?? 0)) > EPS);
    if (!change && !differs) {
      unchanged++;
      continue;
    }
    const guids = new Set([...(a?.trace.elements ?? []), ...(b?.trace.elements ?? [])].map((e) => e.guid));
    const causes = new Set<Cause>();
    for (const g of guids) {
      const c = changeOf.get(g);
      if (c) causes.add(`elements_${c}` as Cause);
    }
    if (ovFrom.get(key) !== ovTo.get(key)) causes.add("override_changed");
    if (rulesDiffer) causes.add("rules_changed");
    // A line under a new key whose elements were measured before (or the reverse): its rule's key changed.
    if (change === "added" && [...guids].some((g) => measuredBefore.has(g) && !changeOf.has(g))) causes.add("rules_changed");
    if (change === "removed" && [...guids].some((g) => measuredAfter.has(g) && !changeOf.has(g))) causes.add("rules_changed");
    if ([...guids].some((g) => decisions.guids.has(g)) || (decisions.any && causes.size === 0)) causes.add("decision_changed");
    const side = (l: BoqLine) => ({ quantity: l.quantity, unit: l.unit, description: l.description, codes: l.codes });
    const delta = a && b && a.quantity !== null && b.quantity !== null ? round(b.quantity - a.quantity) : !a && b?.quantity != null ? round(b.quantity) : a?.quantity != null && !b ? round(-a.quantity) : null;
    const deltaPct = a && b && a.quantity && b.quantity !== null ? round(((b.quantity - a.quantity) / Math.abs(a.quantity)) * 100) : null;
    lines.push({ lineKey: key, change: change ?? "changed", ...(a ? { before: side(a) } : {}), ...(b ? { after: side(b) } : {}), delta, deltaPct, causes: [...causes] });
  }
  // The order of the newer run, then removed lines in the older one's order.
  const order = new Map([...after.keys(), ...before.keys()].map((k, i) => [k, i]));
  lines.sort((x, y) => order.get(x.lineKey)! - order.get(y.lineKey)!);

  const asked = (s: DiffSide) => new Set(s.askedQuestionIds);
  const q1 = asked(from);
  const q2 = asked(to);
  const questions = { new: [...q2].filter((q) => !q1.has(q)), resolved: [...q1].filter((q) => !q2.has(q)) };
  const count = (c: string) => lines.filter((l) => l.change === c).length;
  const models = [...new Set(elements.map((e) => e.model))];
  return {
    summary: {
      linesAdded: count("added"),
      linesRemoved: count("removed"),
      linesChanged: count("changed"),
      linesUnchanged: unchanged,
      elementsAdded: elements.filter((e) => e.change === "added").length,
      elementsRemoved: elements.filter((e) => e.change === "removed").length,
      elementsChanged: elements.filter((e) => e.change === "changed").length,
      questionsNew: questions.new.length,
      questionsResolved: questions.resolved.length,
      guidChurnWarning: churn,
      inputsChanged: inputsChanged(from.request, to.request),
      byModel: models.map((model) => ({
        model,
        added: elements.filter((e) => e.model === model && e.change === "added").length,
        removed: elements.filter((e) => e.model === model && e.change === "removed").length,
        changed: elements.filter((e) => e.model === model && e.change === "changed").length,
      })),
    },
    questions,
    lines,
    elements,
  };
}

/* ------------------------------------------------------------------ the change report's Excel (F08 §7) */

export interface ChangeReportSheet {
  title: string;
  subtitle: string;
  summary: [string, string | number][];
  lines: { group: string; lineKey: string; description: string; unit: string; change: string; before: number | null; after: number | null; delta: number | null; deltaPct: number | null; causes: string }[];
  elements: { guid: string; model: string; change: string; fields: string; lines: string }[];
}

const REPORT_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "change_report.py");

function python() {
  if (process.env.IFC_BOQ_PYTHON) return process.env.IFC_BOQ_PYTHON;
  const engine = path.join(PRODUCT_ROOT, "engine");
  const win = path.join(engine, ".venv", "Scripts", "python.exe");
  return existsSync(win) ? win : path.join(engine, ".venv", "bin", "python");
}

/** Writes the change report workbook with openpyxl (`change_report.py`); returns the xlsx bytes. */
export async function changeReportXlsx(input: ChangeReportSheet): Promise<Uint8Array> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "boqlet-changes-"));
  try {
    await writeFile(path.join(dir, "in.json"), JSON.stringify(input));
    await new Promise<void>((resolve, reject) => {
      const child = spawn(python(), [REPORT_SCRIPT, path.join(dir, "in.json"), path.join(dir, "out.xlsx")], { env: { ...process.env, PYTHONUTF8: "1" } });
      let err = "";
      child.stderr.on("data", (d) => (err += String(d)));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`change report failed (${code}): ${err.slice(-500)}`))));
    });
    return new Uint8Array(await readFile(path.join(dir, "out.xlsx")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

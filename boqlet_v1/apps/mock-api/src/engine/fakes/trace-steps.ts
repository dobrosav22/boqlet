/**
 * Fake "Trace steps" (mock-api.md, replaced by EN-013): the plain-words steps of "How it is
 * calculated" (F06 §5, P25), built after the run from what the PoC engine already wrote in each
 * line's trace: the formula, the settings used and every element's share with its note
 * ("area (main, gross 27.28) - 13.6682 (2 openings deducted, mode all) = 13.6118"). Nothing is
 * measured (BR-01): the fake only sums and labels numbers the engine computed.
 *
 * A step's `value` is its contribution to the quantity in the step's unit (deductions negative);
 * the values of the steps before `result` add up to the result (within rounding). When an
 * element's note can't be read, the line falls back to one `start` step with the elements' sum.
 *
 * Known gaps until the engine does it: approximate wording; a derived line's source lines are found
 * by its elements' GlobalIds, so an element measured by two item lines names both.
 */
import type { BoqLine, BoqResult, TraceStep } from "@ifc-boq/types";
import type { EditedLine } from "./line-edits.js";

/** Who made a line's quantity edit (the override's author), by line key. */
export type EditAuthors = (lineKey: string) => string | undefined;

const NUM = String.raw`-?\d+(?:\.\d+)?(?:e-?\d+)?`;
/** "- 13.6682 (2 openings deducted, mode over_threshold, threshold 0.5 by area; 1 kept) per face" */
const DEDUCTION = new RegExp(String.raw`- (${NUM}) \((\d+) (\w+) deducted, mode (\w+)(?:, threshold (${NUM}) by (\w+))?(?:; (\d+) kept)?\)( per face)?`, "g");
const REVEALS = new RegExp(String.raw`\+ (${NUM}) reveals( per face)?`, "g");
/** "area (main, gross 27.28) …", "volume (gross 3.2) …", "length (axis) 12.5 …", "area (main) = 12.3 …" */
const HEAD = /^(area|volume|length) \(([^)]*)\)/;
const GROSS_IN_LABEL = new RegExp(String.raw`,? ?gross (${NUM})$`);
const AFTER_HEAD = new RegExp(String.raw`^ (?:= )?(${NUM})`);
const FACTOR = new RegExp(String.raw`x factor (${NUM})`);
const FROM_SLOT = /\s*\(from slot ([A-Za-z0-9_]+)\)\s*$/;

interface Deduction {
  what: string;
  amount: number;
  count: number;
  kept: number;
  mode: string;
  threshold?: number;
  compareBy?: string;
}
interface Parsed {
  measure: string;
  label: string;
  gross: number;
  deductions: Deduction[];
  reveals: number;
  factor?: number;
}

/** Reads an element's note; `null` when it isn't a gross-minus-deductions note. */
function parseNote(note: string): Parsed | null {
  const text = note.replace(/^\[\w+\]\s*/, "");
  const head = text.match(HEAD);
  if (!head) return null;
  const [whole, measure, rawLabel] = head;
  const inLabel = rawLabel!.match(GROSS_IN_LABEL);
  const label = inLabel ? `${rawLabel!.slice(0, inLabel.index).trim()}${measure === "area" ? ", gross" : "gross"}` : rawLabel!;
  const gross = Number(inLabel?.[1] ?? text.slice(whole.length).match(AFTER_HEAD)?.[1]);
  if (!Number.isFinite(gross)) return null;
  const deductions: Deduction[] = [];
  for (const d of text.matchAll(DEDUCTION)) {
    const faces = d[8] ? 2 : 1;
    deductions.push({
      amount: Number(d[1]) * faces,
      count: Number(d[2]) * faces,
      what: d[3]!,
      mode: d[4]!,
      ...(d[5] !== undefined ? { threshold: Number(d[5]), compareBy: d[6] } : {}),
      kept: Number(d[7] ?? 0) * faces,
    });
  }
  let reveals = 0;
  for (const r of text.matchAll(REVEALS)) reveals += Number(r[1]) * (r[2] ? 2 : 1);
  const factor = text.match(FACTOR);
  return { measure: measure!, label: label!.trim(), gross, deductions, reveals, ...(factor ? { factor: Number(factor[1]) } : {}) };
}

/** The kind of quantity the note starts with ("area …", "[count] count = 1"), for the start step's sentence. */
function measureOf(note: string | undefined): string {
  const word = (note ?? "").replace(/^\[\w+\]\s*/, "").match(/^(area|volume|length|count|mass|perimeter)\b/)?.[1];
  return word ?? "value";
}

/** The start step's params from the note's label: area "main, gross" → surface and start; volume "net" → start; length "axis" → basis. */
function labelParams(measure: string, label: string): Record<string, string> {
  if (measure === "volume") return label ? { start: label } : {};
  if (measure === "length") return label ? { basis: label } : {};
  const [surface = "", start] = label.split(",").map((s) => s.trim());
  return { surface: surface.replace(/\s*\(faces\)$/, "").replace(/ faces$/, ""), ...(start ? { start } : {}) };
}

/** The rule-set slots an item's deductions read, by what they deduct (threshold and mode). */
function deductionSlots(spec: unknown, out = new Map<string, { threshold?: string; mode?: string }>()) {
  if (!spec || typeof spec !== "object") return out;
  const s = spec as Record<string, unknown>;
  const slot = (v: unknown) => (v && typeof v === "object" && "param" in v ? String((v as { param: unknown }).param) : undefined);
  for (const d of (s.deductions as Record<string, unknown>[] | undefined) ?? []) {
    const what = String(d.what);
    if (!out.has(what)) out.set(what, { threshold: slot(d.threshold), mode: slot(d.mode) });
  }
  for (const key of ["options", "then", "else"]) {
    const child = s[key];
    if (key === "options" && child && typeof child === "object") for (const o of Object.values(child)) deductionSlots(o, out);
    else deductionSlots(child, out);
  }
  return out;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-6);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
const definedOnly = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Steps of an item line: start, deductions, reveals, factor, line minimum, rounding. */
function itemSteps(line: BoqLine, quantity: number | null, unit: BoqLine["unit"], ruleSpec: unknown): TraceStep[] {
  const shared = line.trace.elements.filter((e) => e.quantity !== null);
  const missing = line.trace.elements.length - shared.length;
  const guids = (els: typeof shared) => els.map((e) => e.guid).filter(Boolean);
  const measure = measureOf(line.trace.elements[0]?.note);
  if (quantity === null || shared.length === 0)
    return [{ kind: "start", code: "trace.start.missing", params: { count: line.trace.elements.length }, value: null, unit, elements: guids(line.trace.elements) }];

  const parsed = shared.map((e) => ({ e, p: e.note ? parseNote(e.note) : null }));
  const sumShares = sum(shared.map((e) => e.quantity!));
  // Every element's share must be its gross minus deductions plus reveals (times a factor); else one start step.
  let factorDelta = 0;
  const factors = new Set<number>();
  let readable = parsed.every(({ p }) => p !== null);
  if (readable) {
    for (const { e, p } of parsed) {
      const base = p!.gross - sum(p!.deductions.map((d) => d.amount)) + p!.reveals;
      const delta = e.quantity! - base;
      if (Math.abs(delta) <= 1e-3 + Math.abs(e.quantity!) * 1e-4) continue; // the note's own rounding
      if (p!.factor !== undefined && Math.abs(e.quantity! - base * p!.factor) <= 1e-3 + Math.abs(e.quantity!) * 1e-4) {
        factorDelta += delta;
        factors.add(p!.factor);
        continue;
      }
      readable = false;
      break;
    }
  }

  const steps: TraceStep[] = [];
  let running: number;
  if (!readable) {
    running = sumShares;
    steps.push({ kind: "start", code: `trace.start.${measure}`, params: definedOnly({ count: shared.length, missing: missing || undefined }), value: round6(sumShares), unit, elements: guids(shared) });
  } else {
    const first = (parsed.find(({ p }) => p!.deductions.length) ?? parsed[0]!).p!;
    const gross = sum(parsed.map(({ p }) => p!.gross));
    steps.push({
      kind: "start",
      code: `trace.start.${first.measure}`,
      params: definedOnly({ count: shared.length, ...labelParams(first.measure, first.label), missing: missing || undefined }),
      value: round6(gross),
      unit,
      elements: guids(shared),
    });
    running = gross;
    const slots = deductionSlots(ruleSpec);
    const byWhat = new Map<string, { d: Deduction; els: typeof shared }>();
    for (const { e, p } of parsed)
      for (const d of p!.deductions) {
        const g = byWhat.get(d.what);
        if (!g) byWhat.set(d.what, { d: { ...d }, els: [e] });
        else {
          g.d.amount += d.amount;
          g.d.count += d.count;
          g.d.kept += d.kept;
          g.els.push(e);
        }
      }
    for (const [what, { d, els }] of byWhat) {
      const slot = slots.get(what);
      steps.push({
        kind: "deduct",
        code: `trace.deduct.${d.mode === "all" ? "all" : d.mode === "excess_only" ? "excess" : "over_threshold"}`,
        params: definedOnly({ what, count: d.count, kept: d.kept || undefined, mode: d.mode, threshold: d.threshold, compareBy: d.compareBy, modeParam: slot?.mode }),
        value: round6(-d.amount),
        unit,
        elements: guids(els),
        ...(slot?.threshold ? { param: slot.threshold } : {}),
      });
      running -= d.amount;
    }
    const reveals = sum(parsed.map(({ p }) => p!.reveals));
    if (reveals) {
      steps.push({ kind: "add", code: "trace.add.reveals", params: {}, value: round6(reveals), unit, elements: guids(parsed.filter(({ p }) => p!.reveals).map(({ e }) => e)) });
      running += reveals;
    }
    if (factorDelta) {
      steps.push({ kind: "factor", code: "trace.factor", params: definedOnly({ factor: factors.size === 1 ? [...factors][0] : undefined }), value: round6(factorDelta), unit });
      running += factorDelta;
    }
  }

  const minimum = line.notes.find((n) => n.startsWith("raised to line minimum"));
  if (minimum && quantity > running) {
    steps.push({ kind: "add", code: "trace.add.minimum", params: { minimum: quantity }, value: round6(quantity - running), unit });
    running = quantity;
  }
  if (!close(running, quantity)) steps.push({ kind: "round", code: "trace.round", params: {}, value: round6(quantity - running), unit });
  return steps;
}

/** Where derived lines come from: item lines by element GlobalId, and by description (line-scope rules name "line <description>"). */
interface Sources {
  byGuid: Map<string, string[]>;
  byDescription: Map<string, string>;
  descriptions: Map<string, string>;
}

/** The item lines a derived line was derived from, in order (the engine's `sourceLine` first). */
function sourceLinesOf(line: BoqLine, sources: Sources): string[] {
  const out = new Set<string>(line.trace.sourceLine ? [line.trace.sourceLine] : []);
  for (const e of line.trace.elements) {
    if (e.guid) for (const key of sources.byGuid.get(e.guid) ?? []) out.add(key);
    else if (e.name?.startsWith("line ")) {
      const key = sources.byDescription.get(e.name.slice(5));
      if (key) out.add(key);
    }
  }
  return [...out];
}

/** A derived line: one step over its sources (P25 "Formwork = 2 × wall area of line 2.5.1"), then rounding. */
function derivedSteps(line: BoqLine, quantity: number | null, unit: BoqLine["unit"], sources: Sources): TraceStep[] {
  const shared = line.trace.elements.filter((e) => e.quantity !== null);
  const total = sum(shared.map((e) => e.quantity!));
  const [, slot] = line.trace.formula.match(FROM_SLOT) ?? [];
  const lines = sourceLinesOf(line, sources);
  const source = lines[0];
  const steps: TraceStep[] = [
    {
      kind: "derive",
      code: quantity === null ? "trace.derive.missing" : "trace.derive",
      params: definedOnly({
        formula: line.trace.formula.replace(FROM_SLOT, ""),
        sourceLine: source,
        sourceDescription: source ? sources.descriptions.get(source) : undefined,
        sourceLines: lines,
        lines: lines.length,
        count: line.trace.elements.length,
      }),
      value: quantity === null ? null : round6(total),
      unit,
      elements: line.trace.elements.map((e) => e.guid).filter(Boolean),
      ...(slot ? { param: slot } : {}),
    },
  ];
  if (quantity !== null && !close(total, quantity)) steps.push({ kind: "round", code: "trace.round", params: {}, value: round6(quantity - total), unit });
  return steps;
}

/** A manual line: the quantity (or formula result) someone entered. */
function manualSteps(line: BoqLine, quantity: number | null, unit: BoqLine["unit"]): TraceStep[] {
  const formula = line.trace.formula !== "manual item" ? line.trace.formula : undefined;
  return [{ kind: "start", code: quantity === null ? "trace.manual.missing" : "trace.manual", params: definedOnly({ formula }), value: quantity, unit }];
}

/** Puts `trace.steps` on every line of a run's result (after the line edits are applied). */
export function addTraceSteps(result: BoqResult, authors: EditAuthors) {
  const lines = result.lines as EditedLine[];
  const descriptions = new Map(lines.map((l) => [l.key, l.overridden?.engineDescription ?? l.description]));
  const sources: Sources = { byGuid: new Map(), byDescription: new Map(), descriptions };
  for (const l of lines) {
    if (l.ruleKind !== "item") continue;
    sources.byDescription.set(descriptions.get(l.key)!, l.key);
    for (const e of l.trace.elements) if (e.guid) sources.byGuid.set(e.guid, [...new Set([...(sources.byGuid.get(e.guid) ?? []), l.key])]);
  }
  const items = new Map(((result.ruleSet as { items?: { id: string; quantity?: unknown }[] }).items ?? []).map((i) => [i.id, i.quantity]));
  for (const line of lines) {
    const edit = line.overridden?.fields.includes("quantity") ? line.overridden : undefined;
    const engineQuantity = edit ? (edit.engineQuantity ?? null) : line.quantity;
    const engineUnit = (edit?.engineUnit ?? line.unit) as BoqLine["unit"];
    const steps =
      line.ruleKind === "derived"
        ? derivedSteps(line, engineQuantity, engineUnit, sources)
        : line.ruleKind === "manual"
          ? manualSteps(line, engineQuantity, engineUnit)
          : itemSteps(line, engineQuantity, engineUnit, items.get(line.ruleId));
    if (edit) {
      steps.push({
        kind: "edit",
        code: line.quantity === null ? "trace.edit.flagged" : "trace.edit.quantity",
        params: definedOnly({
          engineQuantity,
          quantity: line.quantity,
          engineUnit: edit.engineUnit,
          by: authors(line.key),
          reason: edit.reason,
        }),
        value: line.quantity === null ? null : round6(line.quantity - (engineQuantity ?? 0)),
        unit: line.unit,
      });
    }
    steps.push({ kind: "result", code: "trace.result", params: {}, value: line.quantity, unit: line.unit });
    line.trace.steps = steps;
  }
}

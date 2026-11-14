/**
 * Line edits over a run's lines (F06 §6–7), pure and tested. The sheet shows the BoQ's *current*
 * edits at once, while the run only has the edits it was generated with: each line is rebuilt from
 * the engine's values (kept in `overridden` by the run) and the current edit is laid over them.
 * Manual lines saved since the run show as pending rows until the next run.
 */
import type { EditBatch, LineOverride, LineOverrideInput, ManualItemRecord } from "@/api/hooks/edits";
import type { RunLine } from "@/api/hooks/sheet";

export type EditField = "quantity" | "description" | "unit" | "codes" | "excluded" | "order";
type LineCode = RunLine["codes"][string];

export interface CodeEntry {
  code: string;
  title: string;
  parent?: string;
}
/** Code lists by system id (the key of a line's `codes`), each by code. */
export type CodeLists = ReadonlyMap<string, ReadonlyMap<string, CodeEntry>>;

export interface EngineValues {
  quantity: number | null;
  description: string;
  unit: string;
  codes: Record<string, string | null>;
}

export interface SheetLine extends RunLine {
  /** The current edit of the line, if any, and what the engine said for each field. */
  edit?: { override: LineOverride; fields: EditField[]; engine: EngineValues };
  excluded?: boolean;
  /** Where the line goes within its section (`null`: first), from its edit or its manual line. */
  sortAfter?: string | null;
  /** The manual line's record (manual lines only). */
  manual?: ManualItemRecord;
  /** A manual line saved since the run: it gets its quantity and codes on the next run. */
  pending?: boolean;
}

/** A code on a line the way the engine puts it there: with its path, following `parent` (classify.py). */
export function lineCodeFor(system: string, code: string, lists: CodeLists): LineCode {
  const list = lists.get(system);
  const entry = list?.get(code);
  if (!list || !entry) return { system, code, title: "", path: [{ code, title: "" }], source: "decision" };
  const path: { code: string; title: string }[] = [];
  for (let cur: CodeEntry | undefined = entry, guard = 0; cur && guard < 20; cur = cur.parent ? list.get(cur.parent) : undefined, guard++) path.unshift({ code: cur.code, title: cur.title });
  return { system, code: entry.code, title: entry.title, path, source: "decision" };
}

/** The line as the engine produced it, before any edit (the run may have applied older edits). */
export function engineValues(line: RunLine): EngineValues {
  const o = line.overridden;
  const has = (f: EditField) => !!o?.fields.includes(f);
  const codes: Record<string, string | null> = Object.fromEntries(Object.entries(line.codes).map(([s, c]) => [s, c.code]));
  if (has("codes")) for (const [s, c] of Object.entries(o!.engineCodes ?? {})) codes[s] = c ?? null;
  return {
    quantity: has("quantity") ? (o!.engineQuantity ?? null) : line.quantity,
    description: has("description") ? (o!.engineDescription ?? line.description) : line.description,
    unit: has("unit") ? (o!.engineUnit ?? line.unit) : line.unit,
    codes,
  };
}

/** The fields an edit changes. */
export function editedFields(o: Pick<LineOverrideInput, "quantity" | "description" | "unit" | "codes" | "excluded" | "sortAfter">): EditField[] {
  const out: EditField[] = [];
  if (o.quantity !== undefined) out.push("quantity");
  if (o.unit !== undefined) out.push("unit");
  if (o.description !== undefined) out.push("description");
  if (o.codes && Object.keys(o.codes).length) out.push("codes");
  if (o.excluded) out.push("excluded");
  if (o.sortAfter !== undefined) out.push("order");
  return out;
}

function manualLine(m: ManualItemRecord, lists: CodeLists, index: number): SheetLine {
  const item = m.item;
  const quantity = typeof item.quantity === "number" ? item.quantity : null;
  return {
    key: item.id,
    ruleId: item.id,
    ruleKind: "manual",
    description: typeof item.description === "string" ? item.description : item.id,
    unit: item.unit as RunLine["unit"],
    quantity,
    source: quantity === null ? "flagged" : "manual",
    keys: {},
    trace: { formula: "", params: {}, elements: [] } as unknown as RunLine["trace"],
    codes: Object.fromEntries(Object.entries(m.codes ?? {}).map(([s, c]) => [s, lineCodeFor(s, c, lists)])),
    tags: item.tags ?? [],
    notes: [],
    sortIndex: index,
    manual: m,
    pending: true,
    ...(m.sortHint ? { sortAfter: m.sortHint } : {}),
  };
}

/**
 * The lines as the sheet shows them: the engine's values with the current edits laid over, the
 * manual lines' records attached, and manual lines the run doesn't have yet appended as pending.
 */
export function effectiveLines(lines: readonly RunLine[], overrides: readonly LineOverride[], manual: readonly ManualItemRecord[], lists: CodeLists): SheetLine[] {
  const byKey = new Map(overrides.map((o) => [o.lineKey, o]));
  const manualById = new Map(manual.map((m) => [m.item.id, m]));
  const out: SheetLine[] = lines.map((line) => {
    const o = byKey.get(line.key);
    const m = line.ruleKind === "manual" ? manualById.get(line.ruleId) : undefined;
    if (!o && !line.overridden && !m) return line;
    const engine = engineValues(line);
    const next: SheetLine = { ...line, quantity: engine.quantity, description: engine.description, unit: engine.unit as RunLine["unit"], codes: { ...line.codes }, excluded: false };
    delete next.overridden;
    // Codes the run moved go back to the engine's before the current edit applies.
    for (const [system, code] of Object.entries(engine.codes)) {
      if (line.codes[system]?.code === code) continue;
      if (code === null) delete next.codes[system];
      else next.codes[system] = lineCodeFor(system, code, lists);
    }
    if (m) {
      next.manual = m;
      if (m.sortHint) next.sortAfter = m.sortHint;
    }
    if (o) {
      if (o.quantity !== undefined) {
        next.quantity = o.quantity;
        if (o.quantity === null) next.source = "flagged";
      }
      if (o.unit !== undefined) next.unit = o.unit as RunLine["unit"];
      if (o.description !== undefined) next.description = o.description;
      for (const [system, code] of Object.entries(o.codes ?? {})) next.codes[system] = lineCodeFor(system, code, lists);
      next.excluded = !!o.excluded;
      if (o.sortAfter !== undefined) next.sortAfter = o.sortAfter;
      const fields = editedFields(o);
      if (fields.length) next.edit = { override: o, fields, engine };
    }
    return next;
  });
  const inRun = new Set(lines.filter((l) => l.ruleKind === "manual").map((l) => l.ruleId));
  manual.filter((m) => !inRun.has(m.item.id)).forEach((m, i) => out.push(manualLine(m, lists, lines.length + i)));
  return out;
}

/**
 * Lines of one section in display order: by `sortIndex`, then each line with `sortAfter` moved after
 * its target (or first, for `null`) when the target is in the same section. Presentation only.
 */
export function orderSection<L extends Pick<SheetLine, "key" | "sortIndex" | "sortAfter">>(lines: readonly L[]): L[] {
  const out = [...lines].sort((a, b) => a.sortIndex - b.sortIndex);
  const keys = new Set(out.map((l) => l.key));
  const moving = out.filter((l) => l.sortAfter !== undefined && (l.sortAfter === null || (keys.has(l.sortAfter) && l.sortAfter !== l.key)));
  for (const line of moving) {
    out.splice(out.indexOf(line), 1);
    out.splice(line.sortAfter === null ? 0 : out.findIndex((l) => l.key === line.sortAfter) + 1, 0, line);
  }
  return out;
}

/** The override to send (a replacement): the current one with `change` laid over; fields set to `undefined` are dropped. */
export function withChange(current: LineOverride | undefined, lineKey: string, change: Partial<LineOverrideInput>): LineOverrideInput | null {
  const base: LineOverrideInput = current
    ? {
        lineKey,
        ...(current.quantity !== undefined ? { quantity: current.quantity } : {}),
        ...(current.description !== undefined ? { description: current.description } : {}),
        ...(current.unit !== undefined ? { unit: current.unit } : {}),
        ...(current.codes && Object.keys(current.codes).length ? { codes: current.codes } : {}),
        ...(current.sortAfter !== undefined ? { sortAfter: current.sortAfter } : {}),
        ...(current.excluded ? { excluded: true } : {}),
        ...(current.reason ? { reason: current.reason } : {}),
      }
    : { lineKey };
  const next: LineOverrideInput = { ...base, ...change, lineKey };
  for (const k of Object.keys(next) as (keyof LineOverrideInput)[]) if (next[k] === undefined) delete next[k];
  if (next.codes && !Object.keys(next.codes).length) delete next.codes;
  if (next.excluded === false) delete next.excluded;
  // A unit edit goes with its quantity: restoring the quantity restores the unit.
  if (next.quantity === undefined) delete next.unit;
  // The reason belongs to a quantity or an exclusion.
  if (next.quantity === undefined && !next.excluded) delete next.reason;
  return editedFields(next).length ? next : null;
}

/** "Restore" one field (F06 §6): the override without it, or `null` when nothing is left. */
export function restoreField(current: LineOverride, field: EditField): LineOverrideInput | null {
  const change: Partial<LineOverrideInput> =
    field === "quantity" ? { quantity: undefined, unit: undefined } : field === "codes" ? { codes: undefined } : field === "order" ? { sortAfter: undefined } : field === "excluded" ? { excluded: undefined } : { [field]: undefined };
  return withChange(current, current.lineKey, change);
}

/** An edit as a batch, and the batch that undoes it (F06 §6: the last 20 edits can be undone). */
export function batchFor(changes: ReadonlyMap<string, LineOverrideInput | null>, current: ReadonlyMap<string, LineOverride>) {
  const toInput = (o: LineOverride): LineOverrideInput => withChange(o, o.lineKey, {}) ?? { lineKey: o.lineKey };
  const apply = { overrides: [...changes.values()].filter((o): o is LineOverrideInput => o !== null), removeOverrideLineKeys: [...changes].filter(([, o]) => o === null).map(([k]) => k) };
  const undo = {
    overrides: [...changes.keys()].flatMap((k) => (current.has(k) ? [toInput(current.get(k)!)] : [])),
    removeOverrideLineKeys: [...changes.keys()].filter((k) => !current.has(k)),
  };
  return { apply, undo };
}

/** One undoable edit: what it applied (to re-apply it) and its inverse. */
export interface UndoBatch {
  apply: EditBatch;
  undo: EditBatch;
}

/**
 * Someone else saved these lines (F06 §14, BR-29: the later edit wins): my undo no longer touches them
 * (Ctrl+Z undoes only my own edits), and what I had applied to them comes back, so I can put it back.
 * Entries left with nothing to undo are dropped.
 */
export function takeLinesFromUndo<E extends { kind: string }>(stack: readonly (E | ({ kind: "batch" } & UndoBatch))[], keys: ReadonlySet<string>) {
  const mine = new Map<string, LineOverrideInput | null>();
  const next: (E | ({ kind: "batch" } & UndoBatch))[] = [];
  for (const entry of stack) {
    if (entry.kind !== "batch" || !("apply" in entry)) {
      next.push(entry);
      continue;
    }
    for (const o of entry.apply.overrides ?? []) if (keys.has(o.lineKey)) mine.set(o.lineKey, o);
    for (const k of entry.apply.removeOverrideLineKeys ?? []) if (keys.has(k)) mine.set(k, null);
    const keep = (b: EditBatch): EditBatch => ({ overrides: (b.overrides ?? []).filter((o) => !keys.has(o.lineKey)), removeOverrideLineKeys: (b.removeOverrideLineKeys ?? []).filter((k) => !keys.has(k)) });
    const undo = keep(entry.undo);
    if (undo.overrides!.length || undo.removeOverrideLineKeys!.length) next.push({ ...entry, apply: keep(entry.apply), undo });
  }
  return { stack: next, mine };
}

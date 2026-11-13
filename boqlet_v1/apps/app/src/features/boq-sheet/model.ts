/**
 * The sheet's rows, built client-side from a run's lines (F06 §1–4): filtered, grouped by one
 * classification's code path with subtotals, lines without a code in that system last under
 * "Unclassified" (never hidden, BR-03). Lines carry their current edits (`edits.ts`): excluded lines
 * stay listed but leave the subtotals, and edits' order applies within each section.
 * Pure functions: no React, no formatting.
 */
import { orderSection, type SheetLine } from "./edits";

export type Source = "measured" | "derived" | "manual" | "flagged";
/** The source filter also lists edited and excluded lines (F06 §4, §6). */
export type SourceFilter = Source | "edited" | "excluded";

export interface SheetFilters {
  source?: SourceFilter;
  storey?: string;
  family?: string;
  /** Engine model id (as in the trace's elements). */
  model?: string;
  q?: string;
  /** Top-level code in the Group-by system (`UNCLASSIFIED` for lines without one), F07 §9. */
  group?: string;
  /** Only these lines ("only these lines" from a selection in the model, F07 §9). */
  keys?: ReadonlySet<string>;
}

export interface GroupRow {
  kind: "group";
  id: string;
  depth: number;
  code: string;
  /** null for the "Unclassified" group (the UI names it). */
  title: string | null;
  lineCount: number;
  /** Set when every line under the group has the same unit. */
  unit: string | null;
  quantity: number | null;
  collapsed: boolean;
}
export interface LineRow {
  kind: "line";
  id: string;
  depth: number;
  line: SheetLine;
}
export type Row = GroupRow | LineRow;

export const UNCLASSIFIED = "~unclassified";

export function filterLines(lines: SheetLine[], f: SheetFilters, system: string | null = null): SheetLine[] {
  const q = f.q?.trim().toLowerCase();
  const group = system ? f.group : undefined;
  if (!f.source && !f.storey && !f.family && !f.model && !q && !group && !f.keys) return lines;
  return lines.filter((l) => {
    if (f.keys && !f.keys.has(l.key)) return false;
    if (group && (l.codes[system!]?.path[0]?.code ?? UNCLASSIFIED) !== group) return false;
    if (f.source === "edited" ? !l.edit : f.source === "excluded" ? !l.excluded : f.source && l.source !== f.source) return false;
    if (f.storey && l.location?.storey !== f.storey && !l.location?.storeys?.includes(f.storey)) return false;
    if (f.family && l.family !== f.family) return false;
    if (f.model && !l.trace.elements.some((e) => e.model === f.model)) return false;
    if (q && !l.description.toLowerCase().includes(q) && !Object.values(l.codes).some((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** The lines under a group row (its id is the code path joined by "/"), F07 §9 "Groups". */
export function linesInGroup(lines: readonly SheetLine[], system: string | null, groupId: string): string[] {
  if (!system) return [];
  return lines
    .filter((l) => {
      const path = (l.codes[system]?.path ?? []).map((p) => p.code);
      if (groupId === UNCLASSIFIED) return path.length === 0;
      const id = groupId.split("/");
      return id.every((code, i) => path[i] === code);
    })
    .map((l) => l.key);
}

/** Top-level groups of a system, for the code-group filter. */
export function topGroups(lines: readonly SheetLine[], system: string | null) {
  if (!system) return [];
  const out = new Map<string, string>();
  for (const l of lines) {
    const top = l.codes[system]?.path[0];
    out.set(top?.code ?? UNCLASSIFIED, top ? `${top.code} ${top.title}` : "");
  }
  return [...out].sort(([a], [b]) => (a === UNCLASSIFIED ? 1 : b === UNCLASSIFIED ? -1 : a.localeCompare(b, undefined, { numeric: true }))).map(([code, label]) => ({ code, label }));
}

/** Distinct values for the filter menus. */
export function facets(lines: SheetLine[]) {
  const storeys = new Set<string>();
  const families = new Set<string>();
  const models = new Set<string>();
  for (const l of lines) {
    if (l.location?.storey) storeys.add(l.location.storey);
    for (const s of l.location?.storeys ?? []) storeys.add(s);
    if (l.family) families.add(l.family);
    for (const e of l.trace.elements) if (e.model) models.add(e.model);
  }
  const sorted = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { storeys: sorted(storeys), families: sorted(families), models: sorted(models) };
}

interface Node {
  id: string;
  code: string;
  title: string | null;
  children: Map<string, Node>;
  lines: SheetLine[];
  count: number;
  units: Set<string>;
  sum: number;
  /** Lines with a quantity (flagged lines have none). */
  measured: number;
}

const node = (id: string, code: string, title: string | null): Node => ({ id, code, title, children: new Map(), lines: [], count: 0, units: new Set(), sum: 0, measured: 0 });
const byCode = (a: Node, b: Node) => (a.id === UNCLASSIFIED ? 1 : b.id === UNCLASSIFIED ? -1 : a.code.localeCompare(b.code, undefined, { numeric: true }));

/**
 * Rows in display order. Without a system the lines are listed flat. Groups nest by the code path
 * (one level per path segment), each with its line count and, when the unit is shared, the sum.
 */
export function buildRows(lines: SheetLine[], system: string | null, collapsed: ReadonlySet<string> = new Set()): Row[] {
  if (!system) return orderSection(lines).map((line) => ({ kind: "line", id: line.key, depth: 0, line }));
  const ordered = [...lines].sort((a, b) => a.sortIndex - b.sortIndex);
  const root = node("", "", null);
  for (const line of ordered) {
    const path = line.codes[system]?.path ?? [];
    const chain: Node[] = [root];
    let at = root;
    if (path.length === 0) {
      let un = at.children.get(UNCLASSIFIED);
      if (!un) at.children.set(UNCLASSIFIED, (un = node(UNCLASSIFIED, "", null)));
      at = un;
      chain.push(at);
    } else {
      let id = "";
      for (const seg of path) {
        id = id ? `${id}/${seg.code}` : seg.code;
        let next = at.children.get(seg.code);
        if (!next) at.children.set(seg.code, (next = node(id, seg.code, seg.title)));
        at = next;
        chain.push(at);
      }
    }
    at.lines.push(line);
    for (const n of chain) {
      n.count += 1;
      // An excluded line stays listed but is out of the totals (F06 §6).
      if (line.excluded) continue;
      n.units.add(line.unit);
      n.sum += line.quantity ?? 0;
      if (line.quantity !== null) n.measured += 1;
    }
  }
  const rows: Row[] = [];
  const walk = (n: Node, depth: number) => {
    for (const child of [...n.children.values()].sort(byCode)) {
      const shared = child.units.size === 1 ? [...child.units][0]! : null;
      // No sum when the group's lines are all still to confirm: "0" would read as a quantity.
      const isCollapsed = collapsed.has(child.id);
      rows.push({ kind: "group", id: child.id, depth, code: child.code, title: child.title, lineCount: child.count, unit: shared, quantity: shared && child.measured > 0 ? child.sum : null, collapsed: isCollapsed });
      if (isCollapsed) continue;
      for (const line of orderSection(child.lines)) rows.push({ kind: "line", id: line.key, depth: depth + 1, line });
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return rows;
}

/** m2 → m², ft3 → ft³ (design guidelines: units with superscripts). */
export function displayUnit(unit: string): string {
  return unit.replace(/([a-z])2$/, "$1²").replace(/([a-z])3$/, "$1³");
}

/** Lines in the BoQ by source, for "120 measured · 8 derived · 3 manual · 2 to confirm" (F06 §12). Excluded lines are out of the BoQ. */
export function countsBySource(lines: readonly { source: Source; excluded?: boolean }[]) {
  const counts = { measured: 0, derived: 0, manual: 0, flagged: 0 };
  for (const l of lines) if (!l.excluded) counts[l.source] += 1;
  return counts;
}

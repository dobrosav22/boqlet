/**
 * Links between BoQ lines and model elements, from the line traces (F07 §3–5; ported from the PoC's
 * `links.ts`, no engine logic here):
 *   line -> elements   trace.elements[].guid; derived "per line" rules have no element rows,
 *                      so they take the elements of their source line (trace.sourceLine)
 *   element -> lines   the reverse, including lines that measure the element's aggregate parent
 *   element -> meshes  SceneIndex parts (a roof is drawn by its slabs)
 * Pure functions: no React, no three.js.
 */
import type { SceneIndex } from "@/api/hooks/viewer";

/** What links need of a line (a run line, possibly with the sheet's current edits). */
export interface LinkLine {
  key: string;
  ruleKind: "item" | "derived" | "manual";
  source: "measured" | "derived" | "manual" | "flagged";
  quantity: number | null;
  codes: Record<string, { code: string; title: string; path: { code: string; title: string }[] }>;
  trace: { elements: { guid: string; model?: string }[]; sourceLine?: string };
  /** The line carries a person's edit (F06 §6). */
  edited?: boolean;
}

export type SceneElements = SceneIndex["elements"];

export interface Links {
  elementsOf: (key: string) => string[];
  linesOf: (guid: string) => LinkLine[];
  /** The lines that measure this element itself (not through its aggregate parent). */
  directLinesOf: (guid: string) => LinkLine[];
  meshesOf: (guids: Iterable<string>) => Set<string>;
}

export function buildLinks(lines: readonly LinkLine[], elements: SceneElements): Links {
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const memo = new Map<string, string[]>();
  const elementsOf = (line: LinkLine, depth = 0): string[] => {
    const hit = memo.get(line.key);
    if (hit) return hit;
    let guids = [...new Set(line.trace.elements.map((e) => e.guid).filter(Boolean))];
    if (!guids.length && line.trace.sourceLine && depth < 5) {
      const src = byKey.get(line.trace.sourceLine);
      if (src) guids = elementsOf(src, depth + 1);
    }
    memo.set(line.key, guids);
    return guids;
  };
  const lineMap = new Map<string, LinkLine[]>();
  for (const l of lines) for (const g of elementsOf(l)) lineMap.set(g, [...(lineMap.get(g) ?? []), l]);
  const linesOf = (guid: string) => {
    const out: LinkLine[] = [];
    for (let g: string | undefined = guid, n = 0; g && n < 10; g = elements[g]?.parent, n++) out.push(...(lineMap.get(g) ?? []));
    return [...new Set(out)];
  };
  const meshesOf = (guids: Iterable<string>) => {
    const out = new Set<string>();
    for (const g of guids) for (const p of elements[g]?.parts ?? [g]) out.add(p);
    return out;
  };
  return { elementsOf: (key) => (byKey.has(key) ? elementsOf(byKey.get(key)!) : []), linesOf, directLinesOf: (guid) => lineMap.get(guid) ?? [], meshesOf };
}

/** The element a mesh draws: the mesh itself, or the aggregate whose parts include it (picking a roof slab picks the roof). */
export function elementOfMesh(mesh: string, elements: SceneElements, links: Links): string {
  if (links.directLinesOf(mesh).length) return mesh;
  const parent = elements[mesh]?.parent;
  return parent && elements[parent]?.parts?.includes(mesh) ? parent : mesh;
}

/* ---------------------------------------------------------------- colour modes (F07 §5) */

export type ColorMode = "type" | "coverage" | "code" | "source" | "edited" | "model";

export interface LegendEntry {
  key: string;
  /** A message key (`viewer.legend.*`) or, for code groups and models, the label itself. */
  label: string;
  translate: boolean;
  color: number;
  /** The elements of this entry (a click selects them). */
  guids: string[];
}

export const COVERAGE_COLORS = { measured: 0x9fc29a, excluded: 0xbdb7ad, unmatched: 0xd9534f, coveredByParent: 0xc9dcc5 } as const;
export const SOURCE_COLORS = { measured: 0x9fc29a, derived: 0x7d9be6, edited: 0xf2b705, none: 0xd9d4cc } as const;
export const EDITED_COLORS = { edited: 0xf2b705, unedited: 0xd9d4cc } as const;
const PALETTE = [0x4e79a7, 0xf28e2b, 0x59a14f, 0xb07aa1, 0x76b7b2, 0xedc948, 0xff9da7, 0x9c755f, 0xe15759, 0xbab0ac, 0x86bcb6, 0x8cd17d];
const NO_CODE = 0xd0d0d0;

export interface ColorInput {
  mode: ColorMode;
  elements: SceneElements;
  links: Links;
  /** Coverage mode: the run's coverage (GET /runs/{id}/coverage). */
  coverage?: { measured: string[]; excluded: string[]; unmatched: string[]; coveredByParent: string[] };
  /** Code mode: the classification to colour by. */
  system?: string;
  /** Model mode: each element's model, and the models' labels in order. */
  modelOf?: (guid: string) => string | undefined;
  models?: { id: string; label: string }[];
}

/** Mesh colours for a mode, and its legend. "type" = the viewer's own colours by IFC class. */
export function colorsFor({ mode, elements, links, coverage, system, modelOf, models }: ColorInput) {
  const colors = new Map<string, number>();
  const groups = new Map<string, LegendEntry>();
  const put = (guid: string, entry: Omit<LegendEntry, "guids">) => {
    for (const m of links.meshesOf([guid])) colors.set(m, entry.color);
    const g = groups.get(entry.key) ?? { ...entry, guids: [] };
    g.guids.push(guid);
    groups.set(entry.key, g);
  };
  if (mode === "type") return { colors, legend: [] as LegendEntry[] };

  if (mode === "coverage") {
    if (!coverage) return { colors, legend: [] as LegendEntry[] };
    for (const k of ["measured", "coveredByParent", "excluded", "unmatched"] as const)
      for (const guid of coverage[k]) put(guid, { key: k, label: `coverage.${k}`, translate: true, color: COVERAGE_COLORS[k] });
    return { colors, legend: (["measured", "coveredByParent", "excluded", "unmatched"] as const).map((k) => groups.get(k)).filter((g): g is LegendEntry => !!g) };
  }

  if (mode === "source") {
    for (const guid of Object.keys(elements)) {
      const ls = links.directLinesOf(guid);
      if (!ls.length) continue;
      const k = ls.some((l) => l.edited) ? "edited" : ls.some((l) => l.ruleKind === "item") ? "measured" : "derived";
      put(guid, { key: k, label: `source.${k}`, translate: true, color: SOURCE_COLORS[k] });
    }
    return { colors, legend: (["measured", "derived", "edited"] as const).map((k) => groups.get(k)).filter((g): g is LegendEntry => !!g) };
  }

  if (mode === "edited") {
    // F07 §5 "Edited": elements whose lines carry an edit (F06 §6).
    for (const guid of Object.keys(elements)) {
      const ls = links.directLinesOf(guid);
      if (!ls.length) continue;
      const k = ls.some((l) => l.edited) ? "edited" : "unedited";
      put(guid, { key: k, label: `edited.${k}`, translate: true, color: EDITED_COLORS[k] });
    }
    return { colors, legend: (["edited", "unedited"] as const).map((k) => groups.get(k)).filter((g): g is LegendEntry => !!g) };
  }

  if (mode === "model") {
    const order = models ?? [];
    for (const guid of Object.keys(elements)) {
      const m = modelOf?.(guid);
      const i = order.findIndex((x) => x.id === m);
      if (i < 0) continue;
      put(guid, { key: order[i]!.id, label: order[i]!.label, translate: false, color: PALETTE[i % PALETTE.length]! });
    }
    return { colors, legend: order.map((m) => groups.get(m.id)).filter((g): g is LegendEntry => !!g) };
  }

  // Code group: the top-level code of the element's first measured line in the chosen classification.
  const tops: string[] = [];
  for (const guid of Object.keys(elements)) {
    const ls = links.directLinesOf(guid);
    if (!ls.length) continue;
    const line = ls.find((l) => l.ruleKind === "item") ?? ls[0]!;
    const top = system ? line.codes[system]?.path[0] : undefined;
    if (!top) {
      put(guid, { key: "", label: "code.none", translate: true, color: NO_CODE });
      continue;
    }
    if (!tops.includes(top.code)) tops.push(top.code);
    put(guid, { key: top.code, label: `${top.code} ${top.title}`, translate: false, color: PALETTE[tops.indexOf(top.code) % PALETTE.length]! });
  }
  const legend = [...groups.values()].sort((a, b) => (a.key === "" ? 1 : b.key === "" ? -1 : a.key.localeCompare(b.key, undefined, { numeric: true })));
  return { colors, legend };
}

/**
 * Links between BoQ lines and model elements, from the line traces (no engine logic here):
 *   line -> elements   trace.elements[].guid; derived "per line" rules have no element rows,
 *                      so they take the elements of their source line (trace.sourceLine)
 *   element -> lines   the reverse, including lines that measure the element's aggregate parent
 *   element -> meshes  SceneIndex parts (a roof is drawn by its slab)
 */
import type { BoqLine, BoqResult, SceneIndex } from "@ifc-boq/types";

export interface Links {
  elementsOf: (line: BoqLine) => string[];
  linesOf: (guid: string) => BoqLine[];
  meshesOf: (guids: Iterable<string>) => Set<string>;
}

export function buildLinks(result: BoqResult, scene: SceneIndex | null): Links {
  const byKey = new Map(result.lines.map((l) => [l.key, l]));
  const memo = new Map<string, string[]>();
  const elementsOf = (line: BoqLine, depth = 0): string[] => {
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

  const lines = new Map<string, BoqLine[]>();
  for (const l of result.lines) for (const g of elementsOf(l)) lines.set(g, [...(lines.get(g) ?? []), l]);
  const linesOf = (guid: string) => {
    const out: BoqLine[] = [];
    for (let g: string | undefined = guid, n = 0; g && n < 5; g = scene?.elements[g]?.parent, n++) out.push(...(lines.get(g) ?? []));
    return [...new Set(out)];
  };

  const meshesOf = (guids: Iterable<string>) => {
    const out = new Set<string>();
    for (const g of guids) for (const p of scene?.elements[g]?.parts ?? [g]) out.add(p);
    return out;
  };
  return { elementsOf: (l) => elementsOf(l), linesOf, meshesOf };
}

/* ---------------------------------------------------------------- colour modes */

export type ColorMode = "type" | "coverage" | "code";

export const COVERAGE = { measured: 0xc9d3c5, flagged: 0xf2c14e, derivedOnly: 0x9fb8d9, none: 0xd9534f } as const;
export const COVERAGE_LABEL = { measured: "Measured", flagged: "In a line to confirm", derivedOnly: "Only in estimates", none: "Not in the BoQ" } as const;
const PALETTE = [0x4e79a7, 0xf28e2b, 0x59a14f, 0xb07aa1, 0x76b7b2, 0xedc948, 0xff9da7, 0x9c755f, 0xe15759, 0xbab0ac, 0x86bcb6, 0x8cd17d];

/** Mesh colours for a mode, plus a legend. "type" = the viewer's own colours by IFC class. */
export function colorsFor(mode: ColorMode, scene: SceneIndex | null, links: Links, system?: string) {
  const colors = new Map<string, number>();
  const legend: { color: number; label: string; count: number }[] = [];
  if (mode === "type" || !scene) return { colors, legend };
  const count = new Map<string, number>();
  const set = (guid: string, color: number, label: string) => {
    for (const m of links.meshesOf([guid])) colors.set(m, color);
    count.set(label, (count.get(label) ?? 0) + 1);
  };
  if (mode === "coverage") {
    for (const guid of Object.keys(scene.elements)) {
      const ls = links.linesOf(guid);
      const k = !ls.length ? "none" : ls.some((l) => l.ruleKind === "item" && l.quantity === null) ? "flagged" : ls.some((l) => l.ruleKind === "item") ? "measured" : "derivedOnly";
      set(guid, COVERAGE[k], COVERAGE_LABEL[k]);
    }
    for (const k of Object.keys(COVERAGE) as (keyof typeof COVERAGE)[])
      if (count.get(COVERAGE_LABEL[k])) legend.push({ color: COVERAGE[k], label: COVERAGE_LABEL[k], count: count.get(COVERAGE_LABEL[k])! });
    return { colors, legend };
  }
  // by top-level code of the first measured line in the chosen classification
  const groups: string[] = [];
  for (const guid of Object.keys(scene.elements)) {
    const ls = links.linesOf(guid);
    const line = ls.find((l) => l.ruleKind === "item") ?? ls[0];
    const top = line && system ? line.codes[system]?.path[0] : undefined;
    const label = top ? `${top.code} ${top.title}` : "No code";
    if (!groups.includes(label)) groups.push(label);
    set(guid, label === "No code" ? 0xd0d0d0 : PALETTE[groups.filter((g) => g !== "No code").indexOf(label) % PALETTE.length], label);
  }
  for (const g of [...groups].sort()) legend.push({ color: g === "No code" ? 0xd0d0d0 : PALETTE[groups.filter((x) => x !== "No code").indexOf(g) % PALETTE.length], label: g, count: count.get(g)! });
  return { colors, legend };
}

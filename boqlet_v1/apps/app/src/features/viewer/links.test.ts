import { describe, expect, it } from "vitest";
import { buildLinks, colorsFor, COVERAGE_COLORS, elementOfMesh, SOURCE_COLORS, type LinkLine, type SceneElements } from "./links";

/** F07 §3–5: links between lines and elements, and the colour modes (FE-016). */

const elements: SceneElements = {
  roof: { ifcClass: "IfcRoof", parts: ["slab1", "slab2"] },
  slab1: { ifcClass: "IfcSlab", parent: "roof" },
  slab2: { ifcClass: "IfcSlab", parent: "roof" },
  wall: { ifcClass: "IfcWall", storey: "L1" },
  door: { ifcClass: "IfcDoor" },
};

const code = (top: string) => ({ s: { code: `${top}.1`, title: "x", path: [{ code: top, title: `Group ${top}` }, { code: `${top}.1`, title: "x" }] } });
const line = (key: string, guids: string[], over: Partial<LinkLine> = {}): LinkLine => ({
  key,
  ruleKind: "item",
  source: "measured",
  quantity: 1,
  codes: code("2"),
  trace: { elements: guids.map((guid) => ({ guid })) },
  ...over,
});

const lines = [
  line("roof-area", ["roof"], { codes: code("3") }),
  line("walls", ["wall"]),
  // A derived per-line rule has no element rows: it takes its source line's elements.
  line("paint", [], { ruleKind: "derived", source: "derived", trace: { elements: [], sourceLine: "walls" } }),
  line("edited", ["wall"], { edited: true }),
];

describe("links (F07 §3, §4)", () => {
  const links = buildLinks(lines, elements);

  it("a line's elements are its trace's, or its source line's", () => {
    expect(links.elementsOf("walls")).toEqual(["wall"]);
    expect(links.elementsOf("paint")).toEqual(["wall"]);
    expect(links.elementsOf("unknown")).toEqual([]);
  });

  it("an aggregate is drawn by its parts (F07-AC1: a roof line highlights the roof's slabs)", () => {
    expect([...links.meshesOf(links.elementsOf("roof-area"))]).toEqual(["slab1", "slab2"]);
  });

  it("an element feeds its own lines and its aggregate parent's", () => {
    expect(links.linesOf("wall").map((l) => l.key)).toEqual(["walls", "paint", "edited"]);
    expect(links.linesOf("slab1").map((l) => l.key)).toEqual(["roof-area"]);
    expect(links.linesOf("door")).toEqual([]);
  });

  it("picking a part of a measured aggregate picks the aggregate", () => {
    expect(elementOfMesh("slab1", elements, links)).toBe("roof");
    expect(elementOfMesh("wall", elements, links)).toBe("wall");
  });
});

describe("colour modes (F07 §5)", () => {
  const links = buildLinks(lines, elements);

  it("coverage colours each status and counts it in the legend", () => {
    const { colors, legend } = colorsFor({ mode: "coverage", elements, links, coverage: { measured: ["wall", "roof"], excluded: [], unmatched: ["door"], coveredByParent: [] } });
    expect(colors.get("door")).toBe(COVERAGE_COLORS.unmatched);
    expect(colors.get("slab1")).toBe(COVERAGE_COLORS.measured);
    expect(legend.map((l) => [l.key, l.guids.length])).toEqual([
      ["measured", 2],
      ["unmatched", 1],
    ]);
  });

  it("source tells measured, derived-only and edited apart", () => {
    const only = buildLinks([line("paint", ["door"], { ruleKind: "derived", source: "derived" }), ...lines.slice(0, 2)], elements);
    const { colors } = colorsFor({ mode: "source", elements, links: only });
    expect(colors.get("door")).toBe(SOURCE_COLORS.derived);
    expect(colors.get("wall")).toBe(SOURCE_COLORS.measured);
    expect(colorsFor({ mode: "source", elements, links }).colors.get("wall")).toBe(SOURCE_COLORS.edited);
  });

  it("code groups by the top-level code of the chosen system, with a group for elements without one", () => {
    const { legend } = colorsFor({ mode: "code", elements, links, system: "s" });
    expect(legend.map((l) => [l.label, l.guids])).toEqual([
      ["2 Group 2", ["wall"]],
      ["3 Group 3", ["roof"]],
    ]);
    expect(colorsFor({ mode: "code", elements, links, system: "other" }).legend.map((l) => l.key)).toEqual([""]);
  });

  it("model colours each model, in input order", () => {
    const modelOf = (g: string) => (g === "wall" ? "b" : "a");
    const { legend } = colorsFor({ mode: "model", elements, links, modelOf, models: [{ id: "a", label: "Architecture" }, { id: "b", label: "Structure" }] });
    expect(legend.map((l) => [l.label, l.guids.length])).toEqual([
      ["Architecture", 4],
      ["Structure", 1],
    ]);
  });

  it("type mode leaves the viewer's own colours", () => {
    expect(colorsFor({ mode: "type", elements, links }).colors.size).toBe(0);
  });
});

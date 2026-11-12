import { describe, expect, it } from "vitest";
import type { RunLine } from "@/api/hooks/sheet";
import { buildRows, displayUnit, facets, filterLines, UNCLASSIFIED, type GroupRow } from "./model";

let n = 0;
function line(path: [string, string][] | null, fields: Partial<RunLine> = {}): RunLine {
  const i = n++;
  return {
    key: `l${i}`,
    ruleId: "r",
    ruleKind: "item",
    description: `Line ${i}`,
    unit: "m2",
    quantity: 10,
    source: "measured",
    keys: {},
    trace: { formula: "net_area", params: {}, elements: [] },
    codes: path ? { acme: { system: "acme", code: path[path.length - 1]![0], title: path[path.length - 1]![1], path: path.map(([code, title]) => ({ code, title })), source: "map" } } : {},
    tags: [],
    notes: [],
    sortIndex: i,
    ...fields,
  } as RunLine;
}

const lines = [
  line([["2", "Superstructure"], ["2.5", "External walls"]]),
  line([["10", "Finishes"]], { unit: "m2", quantity: 5 }),
  line(null, { description: "Unmapped thing" }),
  line([["2", "Superstructure"], ["2.1", "Frame"]], { unit: "m3", quantity: 3, source: "derived" }),
  line([["2", "Superstructure"], ["2.5", "External walls"]], { quantity: 2.5, location: { storey: "Level 1" } }),
];

describe("buildRows (F06 §1, §3)", () => {
  it("nests groups by code path in code order, with Unclassified last, and keeps every line", () => {
    const rows = buildRows(lines, "acme");
    const groups = rows.filter((r): r is GroupRow => r.kind === "group");
    expect(groups.map((g) => [g.id, g.depth])).toEqual([
      ["2", 0],
      ["2/2.1", 1],
      ["2/2.5", 1],
      ["10", 0],
      [UNCLASSIFIED, 0],
    ]);
    expect(rows.filter((r) => r.kind === "line")).toHaveLength(lines.length);
  });

  it("subtotals: line count always, the sum only when the unit is shared", () => {
    const groups = buildRows(lines, "acme").filter((r): r is GroupRow => r.kind === "group");
    const top = groups.find((g) => g.id === "2")!;
    expect(top).toMatchObject({ lineCount: 3, unit: null, quantity: null });
    expect(groups.find((g) => g.id === "2/2.5")).toMatchObject({ lineCount: 2, unit: "m2", quantity: 12.5 });
  });

  it("a group whose lines are all to confirm has no sum", () => {
    const flagged = [line([["9", "Preliminaries"]], { unit: "item", quantity: null, source: "flagged" })];
    expect(buildRows(flagged, "acme")[0]).toMatchObject({ lineCount: 1, unit: "item", quantity: null });
  });

  it("collapsing a group hides its lines and subgroups, not the group", () => {
    const rows = buildRows(lines, "acme", new Set(["2"]));
    expect(rows.map((r) => r.id).slice(0, 2)).toEqual(["2", "10"]);
  });

  it("without a system the lines are flat in engine order", () => {
    expect(buildRows(lines, null).map((r) => r.id)).toEqual(lines.map((l) => l.key));
  });
});

describe("filterLines (F06 §4)", () => {
  it("filters by source, storey and text over description and codes", () => {
    expect(filterLines(lines, { source: "derived" })).toHaveLength(1);
    expect(filterLines(lines, { storey: "Level 1" })).toHaveLength(1);
    expect(filterLines(lines, { q: "unmapped" })).toHaveLength(1);
    expect(filterLines(lines, { q: "finishes" })).toHaveLength(1);
    expect(filterLines(lines, {})).toBe(lines);
  });

  it("offers the distinct storeys", () => {
    expect(facets(lines).storeys).toEqual(["Level 1"]);
  });
});

describe("displayUnit", () => {
  it("writes squares and cubes as superscripts", () => {
    expect(["m2", "m3", "ft2", "m", "nr", "kg/m3"].map(displayUnit)).toEqual(["m²", "m³", "ft²", "m", "nr", "kg/m³"]);
  });
});

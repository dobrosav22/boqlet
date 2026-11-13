import { describe, expect, it } from "vitest";
import type { BoqLine, BoqResult, TraceStep } from "@ifc-boq/types";
import { addTraceSteps } from "../src/engine/fakes/trace-steps.js";
import type { EditedLine } from "../src/engine/fakes/line-edits.js";

/** The "Trace steps" fake (FE-013, until EN-013): steps from the PoC trace that add up to each line's quantity. */

type Element = BoqLine["trace"]["elements"][number];
const el = (guid: string, quantity: number | null, note: string): Element => ({ guid, name: `Wall ${guid}`, quantity, note });

function line<K extends string>(over: Partial<EditedLine> & { key: K }): EditedLine & { key: K } {
  return {
    ruleId: "walls",
    ruleKind: "item",
    description: over.key,
    unit: "m2",
    quantity: 0,
    source: "measured",
    keys: {},
    trace: { formula: "area (main, gross) - openings[all]", params: {}, elements: [] },
    codes: {},
    tags: [],
    notes: [],
    ...over,
  };
}

const RULE_SET = {
  items: [
    {
      id: "walls",
      quantity: {
        kind: "choose",
        pick: { param: "wall_unit" },
        options: {
          area: { kind: "area", deductions: [{ what: "openings", mode: { param: "wall_opening_mode" }, threshold: { param: "wall_opening_threshold" } }] },
        },
      },
    },
  ],
};

function stepsOf<K extends string>(lines: (EditedLine & { key: K })[], authors: (key: string) => string | undefined = () => undefined) {
  const result = { lines, ruleSet: RULE_SET } as unknown as BoqResult;
  addTraceSteps(result, authors);
  return Object.fromEntries(lines.map((l) => [l.key, l.trace.steps!])) as Record<K, TraceStep[]>;
}

/** The steps before `result` add up to it (F06-AC5). */
function addsUp(steps: TraceStep[]) {
  const result = steps.at(-1)!;
  expect(result.kind).toBe("result");
  if (result.value === null) return;
  const sum = steps.slice(0, -1).reduce((s, x) => s + (x.value ?? 0), 0);
  expect(Math.abs(sum - result.value)).toBeLessThan(1e-6);
}

describe("trace steps (fake)", () => {
  it("writes a wall line as gross area, deductions with their setting, rounding and the result", () => {
    const { wall } = stepsOf([
      line({
        key: "wall",
        quantity: 63.34,
        trace: {
          formula: "area (main, gross) - openings[over_threshold > 0.5]",
          params: { wall_opening_threshold: 0.5 },
          elements: [
            el("a", 13.61184, "[area] area (main, gross 27.28) - 13.6682 (2 openings deducted, mode over_threshold, threshold 0.5 by area; 1 kept) = 13.6118"),
            el("b", 49.7248, "[area] area (main) = 49.7248 (no openings to deduct)"),
          ],
        },
      }),
    ]);
    expect(wall.map((s) => s.kind)).toEqual(["start", "deduct", "round", "result"]);
    expect(wall[0]).toMatchObject({ code: "trace.start.area", value: 77.0048, params: { count: 2, surface: "main", start: "gross" }, elements: ["a", "b"] });
    expect(wall[1]).toMatchObject({
      code: "trace.deduct.over_threshold",
      value: -13.6682,
      param: "wall_opening_threshold",
      params: { what: "openings", count: 2, kept: 1, threshold: 0.5, compareBy: "area", modeParam: "wall_opening_mode" },
      elements: ["a"],
    });
    addsUp(wall);
  });

  it("doubles deductions made per face and adds reveals", () => {
    const { both } = stepsOf([
      line({
        key: "both",
        quantity: 46,
        trace: { formula: "", params: {}, elements: [el("a", 46, "area (both faces, gross 50) - 3 (1 openings deducted, mode all) per face + 1 reveals per face = 46")] },
      }),
    ]);
    expect(both.map((s) => [s.kind, s.value])).toEqual([
      ["start", 50],
      ["deduct", -6],
      ["add", 2],
      ["result", 46],
    ]);
    expect(both[0]!.params).toMatchObject({ surface: "both" });
  });

  it("keeps a factor as its own step", () => {
    const { f } = stepsOf([line({ key: "f", quantity: 22, trace: { formula: "", params: {}, elements: [el("a", 22, "area (main, gross 12) - 1 (1 openings deducted, mode all); x factor 2 = 22")] } })]);
    expect(f.map((s) => [s.kind, s.value])).toEqual([
      ["start", 12],
      ["deduct", -1],
      ["factor", 11],
      ["result", 22],
    ]);
  });

  it("falls back to the elements' sum when a note can't be read, and names elements without a value", () => {
    const { count } = stepsOf([
      line({ key: "count", unit: "nr", quantity: 2, trace: { formula: "count", params: {}, elements: [el("a", 1, "count = 1"), el("b", 1, "value supplied by user (1)"), el("c", null, "missing")] } }),
    ]);
    expect(count[0]).toMatchObject({ kind: "start", code: "trace.start.count", value: 2, params: { count: 2, missing: 1 } });
    addsUp(count);
  });

  it("writes a flagged line without a value", () => {
    const { flagged } = stepsOf([line({ key: "flagged", quantity: null, source: "flagged", trace: { formula: "", params: {}, elements: [el("a", null, "missing")] } })]);
    expect(flagged.map((s) => [s.code, s.value])).toEqual([
      ["trace.start.missing", null],
      ["trace.result", null],
    ]);
  });

  it("names every source line of a derived line, by element and by line", () => {
    const steps = stepsOf([
      line({ key: "w1", quantity: 10, trace: { formula: "", params: {}, elements: [el("a", 10, "area (main) = 10")] } }),
      line({ key: "w2", quantity: 5, trace: { formula: "", params: {}, elements: [el("b", 5, "area (main) = 5")] } }),
      line({
        key: "formwork",
        ruleId: "formwork-walls",
        ruleKind: "derived",
        source: "derived",
        quantity: 30,
        trace: { formula: "src.qty * 2   (from slot formwork_walls_formula)", params: {}, sourceLine: "w1", elements: [el("a", 20, ""), el("b", 10, "")] },
      }),
      line({
        key: "edges",
        ruleId: "edges",
        ruleKind: "derived",
        source: "derived",
        quantity: 2,
        trace: { formula: "src.qty / 5", params: {}, sourceLine: "w1", elements: [{ guid: "", name: "line w1", quantity: 2, note: "" }] },
      }),
    ]);
    expect(steps.formwork![0]).toMatchObject({
      kind: "derive",
      param: "formwork_walls_formula",
      value: 30,
      params: { formula: "src.qty * 2", sourceLine: "w1", sourceDescription: "w1", sourceLines: ["w1", "w2"], lines: 2, count: 2 },
    });
    expect(steps.edges![0]!.params).toMatchObject({ sourceLines: ["w1"], lines: 1 });
    for (const s of Object.values(steps)) addsUp(s);
  });

  it("writes a manual line as entered by hand", () => {
    const { m } = stepsOf([line({ key: "m", ruleKind: "manual", source: "manual", unit: "item", quantity: 1, trace: { formula: "manual item", params: {}, elements: [] } })]);
    expect(m.map((s) => [s.code, s.value])).toEqual([
      ["trace.manual", 1],
      ["trace.result", 1],
    ]);
  });

  it("ends an edited line with the engine's value, the edit, who and why (F06 §5)", () => {
    const { e, flag } = stepsOf(
      [
        line({
          key: "e",
          quantity: 300,
          overridden: { fields: ["quantity"], engineQuantity: 267.16, quantity: 300, reason: "measured on site" },
          trace: { formula: "", params: {}, elements: [el("a", 267.16, "area (main) = 267.16")] },
        }),
        line({ key: "flag", quantity: null, source: "flagged", overridden: { fields: ["quantity"], engineQuantity: 5, quantity: null }, trace: { formula: "", params: {}, elements: [el("a", 5, "area (main) = 5")] } }),
      ],
      (key) => (key === "e" ? "Marko" : undefined),
    );
    expect(e.map((s) => s.kind)).toEqual(["start", "edit", "result"]);
    expect(e[0]!.value).toBe(267.16);
    expect(e[1]).toMatchObject({ code: "trace.edit.quantity", value: 32.84, params: { engineQuantity: 267.16, quantity: 300, by: "Marko", reason: "measured on site" } });
    addsUp(e);
    expect(flag.map((s) => [s.code, s.value])).toEqual([
      ["trace.start.area", 5],
      ["trace.edit.flagged", null],
      ["trace.result", null],
    ]);
  });
});

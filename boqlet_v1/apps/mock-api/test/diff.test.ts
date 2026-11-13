import { describe, expect, it } from "vitest";
import type { BoqLine, BoqResult } from "@ifc-boq/types";
import { diffRuns, type DiffSide } from "../src/engine/fakes/diff.js";

/** The "Change report" fake (FE-030, EN-002): lines by key, elements by GlobalId per model, causes. */

const line = (key: string, quantity: number | null, guids: [string, number][], extra: Partial<BoqLine> = {}): BoqLine =>
  ({
    key,
    ruleId: key.split("|")[0]!,
    ruleKind: "item",
    description: key,
    unit: "m2",
    quantity,
    source: "measured",
    keys: {},
    trace: { formula: "area", params: {}, elements: guids.map(([guid, q]) => ({ guid, quantity: q })) },
    codes: { trades: { system: "trades", code: "02.1", title: "Walls", path: [{ code: "02", title: "Masonry" }], source: "map" } },
    tags: [],
    notes: [],
    ...extra,
  }) as BoqLine;

const result = (lines: BoqLine[]) => ({ lines }) as unknown as BoqResult;
const inputs = (versionId: string, ruleSetVersionId = "rs1") => ({ models: [{ modelId: "m1", modelVersionId: versionId }], ruleSetVersionId, classificationVersionIds: ["c1"], dictionaryVersionIds: [] });
const scene = (elements: Record<string, { ifcClass: string; storey?: string; type?: string }>) => ({ elements, spaces: [], openings: [] });

function side(lines: BoqLine[], over: Partial<DiffSide> & { versionId?: string; ruleSet?: string } = {}): DiffSide {
  const versionId = over.versionId ?? "v1";
  return {
    result: result(lines),
    request: { inputs: inputs(versionId, over.ruleSet), ...(over.request ?? {}) } as DiffSide["request"],
    askedQuestionIds: over.askedQuestionIds ?? [],
    models: over.models ?? [{ modelId: "m1", name: "Architecture", versionId }],
  };
}

describe("diffRuns", () => {
  it("same model version: lines only, no element changes; deltas and the threshold's inputs", () => {
    const a = side([line("walls|ext", 100, [["w1", 60], ["w2", 40]]), line("doors|d", 4, [["d1", 4]])], { askedQuestionIds: ["q1", "q2"] });
    const b = side([line("walls|ext", 110, [["w1", 60], ["w2", 50]]), line("roof|r", 80, [["r1", 80]])], { askedQuestionIds: ["q2", "q3"] });
    const d = diffRuns(a, b);
    expect(d.elements).toEqual([]);
    expect(d.summary).toMatchObject({ linesAdded: 1, linesRemoved: 1, linesChanged: 1, linesUnchanged: 0, elementsAdded: 0, questionsNew: 1, questionsResolved: 1, inputsChanged: [] });
    expect(d.questions).toEqual({ new: ["q3"], resolved: ["q1"] });
    const walls = d.lines.find((l) => l.lineKey === "walls|ext")!;
    expect(walls).toMatchObject({ change: "changed", delta: 10, deltaPct: 10, before: { quantity: 100 }, after: { quantity: 110 } });
    expect(d.lines.find((l) => l.lineKey === "roof|r")).toMatchObject({ change: "added", delta: 80, deltaPct: null });
    expect(d.lines.find((l) => l.lineKey === "doors|d")).toMatchObject({ change: "removed", delta: -4 });
  });

  it("a new model version: a deleted wall and a changed door are found, with the lines that lose or change them (F08-AC1)", () => {
    const before = scene({ w1: { ifcClass: "IfcWall", storey: "L1" }, w2: { ifcClass: "IfcWall", storey: "L1" }, d1: { ifcClass: "IfcDoor", type: "D90" } });
    const after = scene({ w1: { ifcClass: "IfcWall", storey: "L1" }, d1: { ifcClass: "IfcDoor", type: "D100" }, w3: { ifcClass: "IfcWall", storey: "L2" } });
    const a = side([line("walls|ext", 100, [["w1", 60], ["w2", 40]]), line("doors|d", 1, [["d1", 1]])], { models: [{ modelId: "m1", name: "Architecture", versionId: "v1", scene: before }] });
    const b = side([line("walls|ext", 75, [["w1", 60], ["w3", 15]]), line("doors|d", 1, [["d1", 1]], { description: "Door 100" })], { versionId: "v2", models: [{ modelId: "m1", name: "Architecture", versionId: "v2", scene: after }] });
    const d = diffRuns(a, b);
    expect(d.elements.map((e) => [e.guid, e.change, e.fields])).toEqual([
      ["d1", "changed", ["type"]],
      ["w3", "added", []],
      ["w2", "removed", []],
    ]);
    expect(d.elements.find((e) => e.guid === "w2")!.lineKeys).toEqual(["walls|ext"]);
    expect(d.summary).toMatchObject({ elementsAdded: 1, elementsRemoved: 1, elementsChanged: 1, inputsChanged: ["inputs.models"], byModel: [{ model: "Architecture", added: 1, removed: 1, changed: 1 }], guidChurnWarning: false });
    expect(d.lines.find((l) => l.lineKey === "walls|ext")!.causes.sort()).toEqual(["elements_added", "elements_removed"]);
    expect(d.lines.find((l) => l.lineKey === "doors|d")!.causes).toEqual(["elements_changed"]);
  });

  it("warns when more than half of a model's elements changed id", () => {
    const a = side([], { models: [{ modelId: "m1", name: "A", versionId: "v1", scene: scene({ a: { ifcClass: "IfcWall" }, b: { ifcClass: "IfcWall" } }) }] });
    const b = side([], { versionId: "v2", models: [{ modelId: "m1", name: "A", versionId: "v2", scene: scene({ c: { ifcClass: "IfcWall" }, d: { ifcClass: "IfcWall" } }) }] });
    expect(diffRuns(a, b).summary.guidChurnWarning).toBe(true);
  });

  it("an edited or excluded line is caused by the edit; a line under a new key by the rules", () => {
    const edit = { lineKey: "walls|ext", quantity: 90, reason: "site" };
    const a = side([line("walls|ext", 100, [["w1", 100]]), line("slab|s", 50, [["s1", 50]])]);
    const b = side(
      [line("walls|ext", 90, [["w1", 100]]), { ...line("slab|s", 50, [["s1", 50]]), excluded: true } as BoqLine, line("walls|ext|L1", 100, [["w1", 100]])],
      { ruleSet: "rs2", request: { inputs: inputs("v1", "rs2"), adjustments: { overrides: [edit, { lineKey: "slab|s", excluded: true }], manualItems: [] } } as never },
    );
    const d = diffRuns(a, b);
    expect(d.lines.find((l) => l.lineKey === "walls|ext")!.causes).toContain("override_changed");
    expect(d.lines.find((l) => l.lineKey === "slab|s")).toMatchObject({ change: "removed", causes: expect.arrayContaining(["override_changed"]) });
    expect(d.lines.find((l) => l.lineKey === "walls|ext|L1")).toMatchObject({ change: "added", causes: ["rules_changed"] });
    expect(d.summary.inputsChanged).toEqual(["inputs.ruleSet", "adjustments"]);
  });

  it("a changed answer is the cause for the lines of the elements it was about", () => {
    const q = (answer: string) => [{ questionId: "q1", answer, question: { guids: ["w1"] } }];
    const a = side([line("walls|ext", 100, [["w1", 100]])], { request: { inputs: inputs("v1"), decisions: q("brick") } as never });
    const b = side([line("walls|ext", 80, [["w1", 80]])], { request: { inputs: inputs("v1"), decisions: q("concrete") } as never });
    const d = diffRuns(a, b);
    expect(d.lines[0]!.causes).toEqual(["decision_changed"]);
    expect(d.summary.inputsChanged).toEqual(["decisions"]);
  });
});

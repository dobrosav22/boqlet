import { describe, expect, it } from "vitest";
import type { LineOverride, ManualItemRecord } from "@/api/hooks/edits";
import type { RunLine } from "@/api/hooks/sheet";
import { batchFor, effectiveLines, engineValues, orderSection, restoreField, withChange, type CodeLists } from "./edits";

const S = "acme";
const lists: CodeLists = new Map([
  [
    S,
    new Map([
      ["B", { code: "B", title: "Substructure" }],
      ["B.01", { code: "B.01", title: "Foundations", parent: "B" }],
      ["C.01", { code: "C.01", title: "Walls" }],
    ]),
  ],
]);
const code = (c: string) => ({ system: S, code: c, title: c, path: [{ code: c, title: c }], source: "map" as const });
const line = (key: string, extra: Partial<RunLine> = {}): RunLine =>
  ({ key, ruleId: key, ruleKind: "item", description: `Line ${key}`, unit: "m2", quantity: 10, source: "measured", keys: {}, trace: { formula: "", params: {}, elements: [] }, codes: { [S]: code("C.01") }, tags: [], notes: [], sortIndex: 0, ...extra }) as RunLine;
const ov = (lineKey: string, extra: Partial<LineOverride> = {}): LineOverride => ({ id: `o-${lineKey}`, boqId: "b", lineKey, createdAt: "2026-11-13T10:00:00Z", ...extra });

describe("effective lines (F06 §6)", () => {
  it("lays the current edit over the engine's values, with the fields and the engine's values kept", () => {
    const [l] = effectiveLines([line("a")], [ov("a", { quantity: 12, reason: "site", description: "New text", codes: { [S]: "B.01" } })], [], lists);
    expect(l).toMatchObject({ quantity: 12, description: "New text", excluded: false });
    expect(l!.codes[S]).toMatchObject({ code: "B.01", path: [{ code: "B" }, { code: "B.01" }] });
    expect(l!.edit).toMatchObject({ fields: ["quantity", "description", "codes"], engine: { quantity: 10, description: "Line a", codes: { [S]: "C.01" } } });
  });

  it("goes back to the engine's values when an edit the run applied has been restored since", () => {
    const applied = line("a", { quantity: 12, description: "Old edit", codes: { [S]: code("B.01") }, excluded: true, overridden: { fields: ["quantity", "description", "codes", "excluded"], engineQuantity: 10, engineDescription: "Line a", engineCodes: { [S]: "C.01" } } });
    expect(engineValues(applied)).toEqual({ quantity: 10, description: "Line a", unit: "m2", codes: { [S]: "C.01" } });
    const [l] = effectiveLines([applied], [], [], lists);
    expect(l).toMatchObject({ quantity: 10, description: "Line a", excluded: false });
    expect(l!.codes[S]!.code).toBe("C.01");
    expect(l!.edit).toBeUndefined();
  });

  it("marks an excluded line and a line marked to confirm", () => {
    const [x, y] = effectiveLines([line("x"), line("y")], [ov("x", { excluded: true, reason: "client" }), ov("y", { quantity: null, reason: "check" })], [], lists);
    expect(x).toMatchObject({ excluded: true, quantity: 10 });
    expect(y).toMatchObject({ quantity: null, source: "flagged" });
  });

  it("adds manual lines saved since the run as pending, with their codes", () => {
    const m: ManualItemRecord = { id: "r1", boqId: "b", createdAt: "", item: { id: "manual-1", kind: "other", description: "Hoarding", unit: "m", quantity: 42 }, codes: { [S]: "B.01" }, sortHint: "a" };
    const out = effectiveLines([line("a")], [], [m], lists);
    expect(out[1]).toMatchObject({ key: "manual-1", quantity: 42, source: "manual", pending: true, sortAfter: "a", manual: m });
    expect(out[1]!.codes[S]!.path.map((p) => p.code)).toEqual(["B", "B.01"]);
    // Once a run has it, it's an ordinary line with its record attached.
    const ran = effectiveLines([line("a"), line("manual-1", { ruleId: "manual-1", ruleKind: "manual", sortIndex: 1 })], [], [m], lists);
    expect(ran).toHaveLength(2);
    expect(ran[1]).toMatchObject({ manual: m, sortAfter: "a" });
    expect(ran[1]!.pending).toBeUndefined();
  });
});

describe("order within a section", () => {
  it("moves a line after its target, or first for null, and ignores targets in other sections", () => {
    const ls = [
      { key: "a", sortIndex: 0 },
      { key: "b", sortIndex: 1 },
      { key: "c", sortIndex: 2, sortAfter: "a" as string | null },
      { key: "d", sortIndex: 3, sortAfter: null as string | null },
      { key: "e", sortIndex: 4, sortAfter: "elsewhere" as string | null },
    ];
    expect(orderSection(ls).map((l) => l.key)).toEqual(["d", "a", "c", "b", "e"]);
  });
});

describe("edits as replacements", () => {
  it("keeps the other fields, drops a unit without its quantity and a reason with nothing to justify", () => {
    const current = ov("a", { quantity: 5, unit: "m3", reason: "site", description: "Text" });
    expect(withChange(current, "a", { excluded: true })).toEqual({ lineKey: "a", quantity: 5, unit: "m3", description: "Text", excluded: true, reason: "site" });
    expect(restoreField(current, "quantity")).toEqual({ lineKey: "a", description: "Text" });
    expect(restoreField(ov("a", { description: "Text" }), "description")).toBeNull();
    expect(withChange(undefined, "b", { codes: { [S]: "B.01" } })).toEqual({ lineKey: "b", codes: { [S]: "B.01" } });
  });

  it("builds the batch and its undo", () => {
    const current = new Map([["a", ov("a", { description: "Old" })]]);
    const { apply, undo } = batchFor(
      new Map([
        ["a", null],
        ["b", { lineKey: "b", excluded: true, reason: "r" }],
      ]),
      current,
    );
    expect(apply).toEqual({ overrides: [{ lineKey: "b", excluded: true, reason: "r" }], removeOverrideLineKeys: ["a"] });
    expect(undo).toEqual({ overrides: [{ lineKey: "a", description: "Old" }], removeOverrideLineKeys: ["b"] });
  });
});

import { describe, expect, it } from "vitest";
import type { DerivedRule, ItemRule, ManualItem, Param, RuleSet, RuleSetPatch } from "@ifc-boq/types";
import { answerParams, answersUsed, applies, bySection, effectiveSections, effectiveSlots, orderQuestions, questionStatus, rowsFor, scopeOf, slotUsage, suggestedKinds, type Slots } from "./model";

const num = (value: number, extra: Partial<Param> = {}): Param => ({ type: "number", value, label: "n", ...extra }) as Param;
const bool = (value: boolean, extra: Partial<Param> = {}): Param => ({ type: "boolean", value, label: "b", ...extra }) as Param;

const wall: ItemRule = { id: "walls", label: "Walls", match: { ifcClass: "IfcWall" }, quantity: { kind: "area", deductions: [{ what: "openings", mode: "over_threshold", threshold: { param: "limit" } }] }, description: "Wall" };
const slab: ItemRule = { id: "slabs", label: "Slabs", match: { ifcClass: "IfcSlab" }, quantity: { kind: "volume" }, description: "Slab", enabled: { param: "slabs_on" } };

const parent: RuleSet = {
  schemaVersion: "1.0",
  id: "base",
  name: "Base",
  version: "1",
  meta: { unitSystem: "metric" },
  params: { limit: num(0.5, { section: "openings" }), slabs_on: bool(true, { section: "scope" }) },
  sections: [
    { id: "scope", title: "Scope" },
    { id: "openings", title: "Openings" },
  ],
  items: [wall, slab],
};

describe("rowsFor", () => {
  it("marks a standalone set's rows as own", () => {
    expect(rowsFor(undefined, [wall], [], false).map((r) => r.status)).toEqual(["own"]);
  });
  it("marks a patch's rows inherited, changed, removed or new", () => {
    const changed = { ...wall, label: "Walls (ours)" };
    const extra = { ...slab, id: "extra" };
    const rows = rowsFor(parent.items, [changed, extra], ["slabs"], true);
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["walls", "changed"],
      ["slabs", "removed"],
      ["extra", "new"],
    ]);
    expect(rows[0]!.entry.label).toBe("Walls (ours)");
  });
});

describe("effectiveSlots and effectiveSections", () => {
  it("lays a patch's answers and own slots over the parent's", () => {
    const patch: RuleSetPatch = { schemaVersion: "1.0", id: "p", name: "P", version: "1", extends: "base", params: { limit: { value: 1 }, own: num(2) } };
    const slots = effectiveSlots(patch, parent);
    expect(slots.limit).toMatchObject({ type: "number", value: 1, section: "openings" });
    expect(slots.own?.value).toBe(2);
    expect(slots.slabs_on?.value).toBe(true);
  });
  it("ignores an answer to a slot the parent doesn't have", () => {
    const patch: RuleSetPatch = { schemaVersion: "1.0", id: "p", name: "P", version: "1", extends: "base", params: { ghost: { value: 1 } } };
    expect(effectiveSlots(patch, parent).ghost).toBeUndefined();
  });
  it("merges a patch's sections by id, new ones last", () => {
    const patch: RuleSetPatch = { schemaVersion: "1.0", id: "p", name: "P", version: "1", extends: "base", sections: [{ id: "openings", title: "Holes" }, { id: "mine", title: "Mine" }] };
    expect(effectiveSections(patch, parent).map((s) => s.title)).toEqual(["Scope", "Holes", "Mine"]);
    expect(effectiveSections(parent, null)).toBe(parent.sections);
  });
});

describe("slot usage", () => {
  it("finds {param} references and p.name in formulas, and follows formula slots", () => {
    const derived: DerivedRule = { id: "formwork", label: "Formwork", from: ["walls"], scope: "line", quantity: { param: "fw" }, unit: "m2", description: "Formwork" };
    const manual: ManualItem = { id: "site", kind: "preliminary", description: "Site", unit: "item", formula: "p.limit * 2" };
    const slots: Slots = { ...parent.params, fw: { type: "formula", value: "src.qty * p.factor", label: "Formwork" }, factor: num(2) };
    const usage = slotUsage([wall, slab, derived, manual], slots);
    expect(usage.limit).toEqual(["walls", "site"]);
    expect(usage.slabs_on).toEqual(["slabs"]);
    expect(usage.fw).toEqual(["formwork"]);
    // read inside the formula slot "fw": used by the items that use fw
    expect(usage.factor).toEqual(["formwork"]);
  });
  it("leaves an item's own switch out of the answers it follows", () => {
    expect(answersUsed(slab)).toEqual([]);
    expect(answersUsed(wall)).toEqual(["limit"]);
  });
  it("lists the items a yes/no answer switches", () => {
    expect(scopeOf([wall, slab], parent.params)).toEqual([{ slot: "slabs_on", label: "Slabs", on: true }]);
  });
});

describe("questions", () => {
  const slots: Slots = {
    mode: { type: "choice", value: "all", options: ["all", "over"], label: "Mode" } as Param,
    limit: num(0.5, { dependsOn: { param: "mode", values: ["over"] } }),
    deep: num(1, { dependsOn: { param: "limit", values: [0.5] } }),
    free: bool(false),
  };
  it("applies a follow-up only when what it depends on has one of its answers, all the way up", () => {
    expect(applies(slots, "free")).toBe(true);
    expect(applies(slots, "limit")).toBe(false);
    expect(applies(slots, "deep")).toBe(false);
    const over = { ...slots, mode: { ...slots.mode!, value: "over" } as Param };
    expect(applies(over, "limit")).toBe(true);
    expect(applies(over, "deep")).toBe(true);
  });
  it("places follow-ups right after their question, indented", () => {
    expect(orderQuestions(slots, ["limit", "free", "mode", "deep"])).toEqual([
      { n: "free", depth: 0 },
      { n: "mode", depth: 0 },
      { n: "limit", depth: 1 },
      { n: "deep", depth: 2 },
    ]);
  });
  it("shows questions in a dependency cycle once each", () => {
    const cyc: Slots = { a: num(1, { dependsOn: { param: "b", values: [1] } }), b: num(1, { dependsOn: { param: "a", values: [1] } }) };
    expect(orderQuestions(cyc, ["a", "b"]).map((x) => x.n)).toEqual(["a", "b"]);
  });
  it("groups slots by section, unknown sections under _other", () => {
    const s = bySection({ ...parent.params, loose: num(1), lost: num(1, { section: "nowhere" }) }, parent.sections!);
    expect(Object.fromEntries(s)).toEqual({ openings: ["limit"], scope: ["slabs_on"], _other: ["loose", "lost"] });
  });
  it("stores only answers that differ from the parent's", () => {
    const slots2 = effectiveSlots({ schemaVersion: "1.0", id: "p", name: "P", version: "1", extends: "base" }, parent);
    expect(answerParams({}, slots2, "limit", 1, true, 0.5)).toEqual({ limit: { value: 1 } });
    expect(answerParams({ limit: { value: 1 } }, slots2, "limit", 0.5, true, 0.5)).toEqual({});
    expect(answerParams({ own: num(1) }, { own: num(1) }, "own", 3, true, undefined)).toEqual({ own: num(3) });
    expect(answerParams({}, parent.params, "limit", 2, false, undefined)).toEqual({ limit: { ...parent.params.limit, value: 2 } });
  });
  it("says where a patch's question comes from", () => {
    expect(questionStatus("limit", {}, parent, true)).toBe("inherited");
    expect(questionStatus("limit", { limit: { value: 1 } }, parent, true)).toBe("answered");
    expect(questionStatus("limit", { limit: num(1) }, parent, true)).toBe("redefined");
    expect(questionStatus("mine", { mine: num(1) }, parent, true)).toBe("new");
    expect(questionStatus("limit", {}, null, false)).toBe("own");
  });
});

describe("suggestedKinds", () => {
  it("offers the ways of measuring that suit the item's elements", () => {
    const kinds = suggestedKinds(wall);
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).toContain("area");
  });
});

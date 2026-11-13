import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RuleSet } from "@ifc-boq/types";
import { checklist, measureScreens, missingAnswers, switchedOnItems } from "./steps";

/** F16 step 1 from "As modelled" with the markers of F16's table (the "Setup markers" fake's data). */
const asModelled = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../presets/rules/as-modelled.json"), "utf8")) as RuleSet;
const MARKERS: Record<string, string> = {
  wall_unit: "walls",
  wall_surface: "walls",
  wall_opening_mode: "wall-openings",
  slab_opening_mode: "slab-openings",
  roof_surface: "roofs",
  window_measure: "windows-doors",
  door_measure: "windows-doors",
  lines_by_storey: "layout",
  include_proxies: "skip",
  include_non_physical: "skip",
};
const STEPS = ["walls", "wall-openings", "slab-openings", "roofs", "windows-doors", "layout"].map((id) => ({ id, title: id }));
const marked: RuleSet = {
  ...asModelled,
  setupSteps: STEPS,
  params: Object.fromEntries(Object.entries(asModelled.params).map(([k, p]) => [k, MARKERS[k] ? { ...p, setup: MARKERS[k] } : p])),
};
const answer = (rs: RuleSet, values: Record<string, unknown>) => ({ ...rs.params, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { ...rs.params[k]!, value: v }])) }) as RuleSet["params"];

describe("F16 step 1 from the rule set's data", () => {
  it("1a: the checklist has the 14 switches of F16's table", () => {
    const slots = checklist(marked).map((s) => s.slot);
    expect(slots).toHaveLength(14);
    expect(slots).toEqual(expect.arrayContaining(["excavation", "blinding", "hardcore", "formwork_separate", "rebar_estimates", "slab_concrete_separate", "room_finishes", "paint_walls", "paint_ceilings", "skirting", "include_mep", "include_prelims", "include_provisional", "include_furniture"]));
    expect(slots).not.toContain("include_proxies");
  });

  it("a new item-switching yes/no question shows up with no frontend change", () => {
    const more: RuleSet = { ...marked, params: { ...marked.params, include_signage: { type: "boolean", value: false, label: "Signage" } }, manual: [...(marked.manual ?? []), { id: "signage", kind: "other", description: "Signage", unit: "item", quantity: 1, enabled: { param: "include_signage" } } as never] };
    expect(checklist(more).map((s) => s.slot)).toContain("include_signage");
  });

  it("1b: a detail screen only for switches turned on; 1c: the six measuring screens", () => {
    const off = measureScreens(marked, answer(marked, { rebar_estimates: false, excavation: false }));
    expect(off.filter((s) => s.kind === "detail").map((s) => s.slot)).not.toContain("rebar_estimates");
    expect(off.filter((s) => s.kind === "measure").map((s) => s.step!.id)).toEqual(["walls", "wall-openings", "slab-openings", "roofs", "windows-doors", "layout"]);
    const on = measureScreens(marked, answer(marked, { rebar_estimates: true }));
    const rebar = on.find((s) => s.id === "detail:rebar_estimates")!;
    expect(rebar.questions.map((q) => q.slot)).toEqual(expect.arrayContaining(["rebar_slab_kg_m3", "rebar_wall_kg_m3", "rebar_footing_kg_m3"]));
  });

  it("reinforcement estimates can't be left at 0 kg per m³", () => {
    const slots = answer(marked, { rebar_estimates: true, rebar_slab_kg_m3: 0, rebar_wall_kg_m3: 0, rebar_footing_kg_m3: 0 });
    const screen = measureScreens(marked, slots).find((s) => s.id === "detail:rebar_estimates")!;
    expect(missingAnswers(screen, slots).sort()).toEqual(["rebar_footing_kg_m3", "rebar_slab_kg_m3", "rebar_wall_kg_m3"]);
    const filled = answer(marked, { rebar_estimates: true, rebar_slab_kg_m3: 100, rebar_wall_kg_m3: 80, rebar_footing_kg_m3: 60 });
    expect(missingAnswers(screen, filled)).toEqual([]);
  });

  it("step 2's rows are the items the answers switch on", () => {
    const ids = (values: Record<string, unknown>) => switchedOnItems(marked, answer(marked, values)).map((e) => e.id);
    const withFurniture = ids({ include_furniture: true });
    const without = ids({ include_furniture: false });
    expect(withFurniture.filter((id) => !without.includes(id)).length).toBeGreaterThan(0);
    expect(without.every((id) => withFurniture.includes(id))).toBe(true);
  });
});

/**
 * Fake "Setup markers" (mock-api.md, replaced by EN-011): the F16 table "Wizard content for As
 * modelled" (P42) as data the mock merges into the flattened rule sets it serves when their lineage
 * is "As modelled": `setupSteps` (part 1c screens, in order) and `setup` on the slots (a step id, or
 * "skip" for switches the checklist leaves out). Parts 1a and 1b need no markers: the wizard derives
 * them from `enabled` and `dependsOn`. A patch that sets its own markers keeps them.
 */
const STEPS = [
  { id: "walls", title: "Walls", intro: "Walls are in every model; m² or m³ and which face are the commonest differences between practices." },
  { id: "wall-openings", title: "Openings in walls", intro: "Which windows and doors are deducted from wall quantities." },
  { id: "slab-openings", title: "Openings in floors and roofs", intro: "Which holes are deducted from slab quantities." },
  { id: "roofs", title: "Roofs", intro: "Roof areas along the slope or on plan." },
  { id: "windows-doors", title: "Windows and doors", intro: "Counted, or measured by area." },
  { id: "layout", title: "How lines are split", intro: "One line per type, or per type and storey." },
];

const SLOTS: Record<string, string> = {
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

const MASTER = "as-modelled";

type Flat = { id?: string; chain?: unknown; setupSteps?: unknown; params?: Record<string, { setup?: string }> };

/** Whether the rule set is As modelled or built on it (the flattened form lists its `chain`). */
function fromMaster(flat: Flat): boolean {
  if (flat.id === MASTER) return true;
  const chain = Array.isArray(flat.chain) ? flat.chain : [];
  return chain.some((c) => c === MASTER || (typeof c === "object" && c !== null && (c as { id?: string }).id === MASTER));
}

/** The flattened rule set with the master's setup markers where it doesn't set its own. */
export function withSetupMarkers<T>(flattened: T): T {
  const flat = flattened as Flat;
  if (!flat || typeof flat !== "object" || !fromMaster(flat)) return flattened;
  const params = { ...(flat.params ?? {}) };
  for (const [slot, step] of Object.entries(SLOTS)) if (params[slot] && params[slot].setup === undefined) params[slot] = { ...params[slot], setup: step };
  return { ...flat, setupSteps: flat.setupSteps ?? STEPS, params } as T;
}

/**
 * The setup wizard's "How you measure" screens (F16 step 1, P42), derived from the rule set's own data,
 * never from a list in the frontend (CLAUDE.md rule 3):
 * - 1a, the checklist: every top-level yes/no question that is some item's `enabled`, minus `setup: "skip"`;
 * - 1b, one screen per switch turned on that has follow-up questions (`dependsOn`);
 * - 1c, the measuring screens of `setupSteps`, each with its questions and their follow-ups.
 */
import type { DerivedRule, ItemRule, ManualItem, Param, RuleSection, RuleSet, SetupStep } from "@ifc-boq/types";
import { applies, followUps, type Slots } from "../library/rule-set/model";

type Entry = ItemRule | DerivedRule | ManualItem;

export interface Switch {
  slot: string;
  section: string | null;
}

export interface Screen {
  /** "checklist", "detail:<switch>", "measure:<step id>" */
  id: string;
  kind: "checklist" | "detail" | "measure";
  /** The switch (detail) or the setup step (measure). */
  slot?: string;
  step?: SetupStep;
  /** The questions on the screen, each with its depth (follow-ups are indented). */
  questions: { slot: string; depth: number }[];
}

const entries = (rs: Pick<RuleSet, "items" | "derived" | "manual">): Entry[] => [...(rs.items ?? []), ...(rs.derived ?? []), ...(rs.manual ?? [])];

/** The slot an entry's `enabled` points at, if any. */
const enabledSlot = (e: Entry): string | undefined => {
  const en = (e as { enabled?: unknown }).enabled;
  return en && typeof en === "object" && "param" in en ? String((en as { param: string }).param) : undefined;
};

/** 1a: the switches, in the rule set's section order (then the order of the slots). */
export function checklist(rs: RuleSet): Switch[] {
  const used = new Set(entries(rs).map(enabledSlot).filter((s): s is string => !!s));
  const order = new Map((rs.sections ?? []).map((s, i) => [s.id, i]));
  const names = Object.keys(rs.params);
  return names
    .filter((n) => {
      const p = rs.params[n]!;
      return p.type === "boolean" && !p.dependsOn && used.has(n) && p.setup !== "skip";
    })
    .sort((a, b) => (order.get(rs.params[a]!.section ?? "") ?? 999) - (order.get(rs.params[b]!.section ?? "") ?? 999) || names.indexOf(a) - names.indexOf(b))
    .map((slot) => ({ slot, section: rs.params[slot]!.section ?? null }));
}

/** A question followed by its follow-ups (recursively) that apply under the current answers. */
function withFollowUps(slots: Slots, slot: string, depth = 0, seen = new Set<string>()): { slot: string; depth: number }[] {
  if (seen.has(slot)) return [];
  seen.add(slot);
  const names = Object.keys(slots);
  const out = [{ slot, depth }];
  for (const f of followUps(slots, slot, names)) if (applies(slots, f)) out.push(...withFollowUps(slots, f, depth + 1, seen));
  return out;
}

/**
 * Every screen of step 1 under the current answers (`slots` are the rule set's slots with them): the
 * checklist, a detail screen for each switch turned on that has follow-ups, then the measuring screens.
 * A rule set without `setupSteps` gets 1a and 1b only (1c then points to the full Settings).
 */
export function measureScreens(rs: RuleSet, slots: Slots): Screen[] {
  const switches = checklist(rs);
  const screens: Screen[] = [{ id: "checklist", kind: "checklist", questions: switches.map((s) => ({ slot: s.slot, depth: 0 })) }];
  for (const s of switches) {
    if (slots[s.slot]?.value !== true) continue;
    const questions = withFollowUps(slots, s.slot).slice(1);
    if (questions.length) screens.push({ id: `detail:${s.slot}`, kind: "detail", slot: s.slot, questions });
  }
  for (const step of rs.setupSteps ?? []) {
    const top = Object.keys(slots).filter((n) => slots[n]!.setup === step.id && !(slots[n]!.dependsOn && slots[slots[n]!.dependsOn!.param]?.setup === step.id));
    const questions = top.flatMap((n) => (applies(slots, n) ? withFollowUps(slots, n) : []));
    if (questions.length) screens.push({ id: `measure:${step.id}`, kind: "measure", step, questions });
  }
  return screens;
}

/**
 * Answers a person must give before leaving the screen: a number follow-up whose value is 0 has no
 * suggested answer (a reinforcement estimate of 0 kg/m³ is never what a person means, F16 1b).
 */
export function missingAnswers(screen: Screen, slots: Slots): string[] {
  if (screen.kind !== "detail") return [];
  return screen.questions.filter(({ slot }) => {
    const p = slots[slot];
    return p?.type === "number" && p.value === 0;
  }).map((q) => q.slot);
}

/** The BoQ items the answers switch on (step 2's rows): items whose `enabled` is unset or true. */
export function switchedOnItems(rs: RuleSet, slots: Slots): Entry[] {
  return entries(rs).filter((e) => {
    const en = (e as { enabled?: unknown }).enabled;
    if (en === undefined || en === true) return true;
    if (en === false) return false;
    const slot = enabledSlot(e);
    return slot ? slots[slot]?.value === true : true;
  });
}

/** The section a switch is shown under (its title), for the grouped checklist. */
export function sectionTitle(sections: RuleSection[] | undefined, id: string | null): string | null {
  return (id && sections?.find((s) => s.id === id)?.title) || null;
}

export type { Param };

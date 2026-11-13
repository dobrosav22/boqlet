/**
 * Pure helpers of the rule-set editor, ported from the PoC (`RuleSetEditor.tsx`, `QuestionsTab.tsx`,
 * `QuestionSetup.tsx`, `itemStory.tsx`): what a patch inherits, which slots items read, which
 * questions apply. Nothing here evaluates a formula: slot names are found in formula text, and
 * that is all (CLAUDE.md rule 4).
 */
import { FAMILY_INFO, IFC_FAMILIES } from "@ifc-boq/types";
import type { DerivedRule, ElementFamily, ItemRule, ManualItem, OurRuleType, Param, QuantitySpec, RuleSection, RuleSet } from "@ifc-boq/types";
import { isRef } from "../shared/fields";
import { isPatch } from "../shared/doc";
import { decomposeMatch } from "../shared/story";

export type Slots = Record<string, Param>;
export type OwnParams = Record<string, Param | { value: Param["value"] }>;
export type Entry = ItemRule | DerivedRule | ManualItem;

/* ---------------------------------------------------------------- inheritance */

/** Where a row of a patch comes from. A standalone set's rows are all "own". */
export type Status = "own" | "new" | "inherited" | "changed" | "removed";
export interface Row<T> {
  id: string;
  entry: T;
  status: Status;
}

/** One list (items, derived or manual) as shown: the parent's rows, then the patch's new ones. */
export function rowsFor<T extends { id: string }>(parentList: T[] | undefined, own: T[] | undefined, removed: string[], patch: boolean): Row<T>[] {
  const mine = own ?? [];
  if (!patch) return mine.map((e) => ({ id: e.id, entry: e, status: "own" }));
  const byId = new Map(mine.map((e) => [e.id, e]));
  const parentIds = new Set((parentList ?? []).map((p) => p.id));
  const rows: Row<T>[] = (parentList ?? []).map((p) =>
    removed.includes(p.id)
      ? { id: p.id, entry: p, status: "removed" }
      : byId.has(p.id)
        ? { id: p.id, entry: byId.get(p.id)!, status: "changed" }
        : { id: p.id, entry: p, status: "inherited" },
  );
  return [...rows, ...mine.filter((e) => !parentIds.has(e.id)).map((e): Row<T> => ({ id: e.id, entry: e, status: "new" }))];
}

/** The slots a set has: a patch's parent slots with the patch's answers and own slots on top. */
export function effectiveSlots(doc: OurRuleType, parent: RuleSet | null): Slots {
  const out: Slots = { ...(parent?.params ?? {}) };
  for (const [k, p] of Object.entries(doc.params ?? {})) {
    if ("type" in p) out[k] = p as Param;
    else if (out[k]) out[k] = { ...out[k], value: p.value } as Param;
  }
  return out;
}

/** The sections a set shows: its own, or for a patch the parent's merged with its own (as the engine does). */
export function effectiveSections(doc: OurRuleType, parent: RuleSet | null): RuleSection[] {
  if (!isPatch(doc)) return (doc as RuleSet).sections ?? [];
  const out = new Map((parent?.sections ?? []).map((s) => [s.id, s]));
  for (const s of doc.sections ?? []) out.set(s.id, { ...out.get(s.id), ...s });
  return [...out.values()];
}

/* ---------------------------------------------------------------- slot usage */

const PARAM_REF = /"param":"([^"]+)"/g;
const P_DOT = /\bp\.([A-Za-z_]\w*)/g;

/** Slot names an object reads (as `{param}` or `p.name` in a formula), in the order it uses them. */
export function slotsRead(entry: object): string[] {
  const blob = JSON.stringify(entry);
  return [...new Set([...blob.matchAll(PARAM_REF), ...blob.matchAll(P_DOT)].map((m) => m[1]!))];
}

/** The Settings answers an entry follows, in the order it uses them (its own switch excluded). */
export function answersUsed(entry: object): string[] {
  const { enabled: _skip, ...rest } = entry as { enabled?: unknown };
  void _skip;
  return slotsRead(rest);
}

/**
 * slot name -> ids of the rules that read it. A slot read inside a formula slot (p.working_space in
 * the excavation formula) counts as used by that formula's rules.
 */
export function slotUsage(entries: { id: string }[], slots: Slots): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of entries) for (const r of slotsRead(e)) (out[r] ??= []).push(e.id);
  for (const [name, p] of Object.entries(slots))
    if (p.type === "formula")
      for (const m of p.value.matchAll(P_DOT)) out[m[1]!] = [...new Set([...(out[m[1]!] ?? []), ...(out[name] ?? [])])];
  return out;
}

/** An item that a yes/no answer switches on or off (its `enabled` points at the slot). */
export interface ScopeEntry {
  slot: string;
  label: string;
  on: boolean;
}

export const entryLabel = (e: Entry) => ("label" in e ? e.label : typeof e.description === "string" ? e.description : e.id);

/** Items a yes/no answer switches on or off, for the "In this BoQ" summary. */
export function scopeOf(entries: Entry[], slots: Slots): ScopeEntry[] {
  const out = new Map<string, ScopeEntry>();
  for (const e of entries) {
    if (!isRef(e.enabled)) continue;
    const s = slots[e.enabled.param];
    if (s?.type !== "boolean") continue;
    const label = entryLabel(e);
    out.set(label, { slot: e.enabled.param, label, on: s.value });
  }
  return [...out.values()];
}

/** Ways of measuring that suit the elements an item takes (FAMILY_INFO), in order. */
export function suggestedKinds(item: ItemRule): QuantitySpec["kind"][] {
  const fams = new Set<ElementFamily>([item.family ?? []].flat());
  for (const c of decomposeMatch(item.match).classes) if (IFC_FAMILIES[c]) fams.add(IFC_FAMILIES[c]);
  return [...new Set([...fams].flatMap((f) => FAMILY_INFO[f].kinds))];
}

/* ---------------------------------------------------------------- questions */

export const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The question applies: what it depends on has one of the listed answers, and applies itself. */
export function applies(slots: Slots, n: string, depth = 0): boolean {
  const d = slots[n]?.dependsOn;
  return !d || depth > 8 || (d.values.some((v) => sameValue(v, slots[d.param]?.value)) && (!slots[d.param] || applies(slots, d.param, depth + 1)));
}

/** Questions that depend on n, in their original order. */
export const followUps = (slots: Slots, n: string, within: string[]) => within.filter((m) => slots[m]?.dependsOn?.param === n);

/** Section order with each follow-up placed right after the question it depends on. */
export function orderQuestions(slots: Slots, list: string[]): { n: string; depth: number }[] {
  const out: { n: string; depth: number }[] = [];
  const seen = new Set<string>();
  const add = (n: string, depth: number) => {
    if (seen.has(n)) return; // a dependency cycle: show each question once
    seen.add(n);
    out.push({ n, depth });
    for (const m of followUps(slots, n, list)) add(m, depth + 1);
  };
  for (const n of list) if (!list.includes(slots[n]?.dependsOn?.param ?? "")) add(n, 0);
  for (const n of list) add(n, 0);
  return out;
}

/** Slot names by the section they show in (`_other` when the section is unknown or missing). */
export function bySection(slots: Slots, sections: RuleSection[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const n of Object.keys(slots)) {
    const s = sections.some((x) => x.id === slots[n]!.section) ? slots[n]!.section! : "_other";
    out.set(s, [...(out.get(s) ?? []), n]);
  }
  return out;
}

/** Where a question of a patch comes from (Questions setup). */
export type QuestionStatus = "own" | "inherited" | "answered" | "redefined" | "new";
export function questionStatus(k: string, own: OwnParams, parent: RuleSet | null, patch: boolean): QuestionStatus {
  const mine = own[k];
  if (!patch) return "own";
  if (mine && "type" in mine) return parent?.params[k] ? "redefined" : "new";
  return mine ? "answered" : "inherited";
}

/**
 * The params after answering slot n with v. A patch stores only answers that differ from the
 * parent's; a slot the set defines itself keeps its definition.
 */
export function answerParams(own: OwnParams, slots: Slots, n: string, v: Param["value"], patch: boolean, parentValue: Param["value"] | undefined): OwnParams {
  const mine = own[n];
  let next: Param | { value: Param["value"] } | undefined;
  if (mine && "type" in mine) next = { ...mine, value: v } as Param;
  else if (patch && parentValue !== undefined && sameValue(parentValue, v)) next = undefined;
  else if (patch) next = { value: v };
  else next = { ...slots[n], value: v } as Param;
  const out = { ...own };
  if (next === undefined) delete out[n];
  else out[n] = next;
  return out;
}

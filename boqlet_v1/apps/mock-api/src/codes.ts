/**
 * The code lists a revision's classifications carry, by the engine's system id (the key of a line's
 * `codes`). Used to check codes in line edits and manual lines, and by the fakes that put a chosen
 * code on a line the way the engine does (the path follows `parent`, as in classify.py).
 */
import type { LineCode } from "@ifc-boq/types";
import { db, type RevisionInputs } from "./store.js";
import { engineIdOf } from "./handlers/boqs.js";

export interface CodeEntry {
  code: string;
  title: string;
  parent?: string;
}
export type CodeLists = Map<string, Map<string, CodeEntry>>;

export function codeListsOf(inputs: RevisionInputs): CodeLists {
  const out: CodeLists = new Map();
  for (const id of inputs.classificationVersionIds) {
    const version = db().presetVersions.find((v) => v.id === id);
    const codes = (version?.doc as { codeList?: { codes?: CodeEntry[] } | null } | undefined)?.codeList?.codes;
    if (version && codes) out.set(engineIdOf(version), new Map(codes.map((c) => [c.code, c])));
  }
  return out;
}

/** A line's code in one system, with its path from the top level. */
export function lineCode(system: string, code: string, lists: CodeLists): LineCode | null {
  const list = lists.get(system);
  const entry = list?.get(code);
  if (!list || !entry) return null;
  const path: { code: string; title: string }[] = [];
  for (let cur: CodeEntry | undefined = entry, guard = 0; cur && guard < 20; cur = cur.parent ? list.get(cur.parent) : undefined, guard++) path.unshift({ code: cur.code, title: cur.title });
  return { system, code: entry.code, title: entry.title, path, source: "decision" };
}

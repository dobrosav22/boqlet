/**
 * Fakes "Line edits applied" and "Manual items with codes" (mock-api.md, replaced by EN-003 and
 * EN-007): after the PoC engine's run, the BoQ's line edits are applied to the result's lines and
 * manual lines get the codes chosen for them. Nothing is measured (BR-01): the fake only puts the
 * values a person entered on the lines, and keeps the engine's values beside them.
 *
 * Known gaps until the engine does it: derived lines don't follow an edited quantity, an edit
 * whose line is gone raises no `orphan_override` question, and map rules don't see manual codes.
 */
import type { BoqLine, BoqResult } from "@ifc-boq/types";
import { lineCode, type CodeLists } from "../../codes.js";
import type { ManualItemRec, OverrideRec } from "../../store.js";

type Field = "quantity" | "description" | "unit" | "codes" | "excluded" | "order";
export interface EditedLine extends BoqLine {
  overridden?: {
    fields: Field[];
    engineQuantity?: number | null;
    quantity?: number | null;
    engineDescription?: string;
    engineUnit?: string;
    engineCodes?: Record<string, string | null>;
    reason?: string;
  };
  excluded?: boolean;
}

/** Codes chosen for manual lines (EN-007): the line of each manual item gets them, source "decision". */
export function applyManualCodes(result: BoqResult, items: ManualItemRec[], lists: CodeLists) {
  for (const item of items) {
    const line = result.lines.find((l) => l.ruleKind === "manual" && l.ruleId === item.item.id);
    if (!line) continue;
    for (const [system, code] of Object.entries(item.codes ?? {})) {
      const lc = lineCode(system, code, lists);
      if (lc) line.codes[system] = lc;
    }
  }
}

/** Line edits (EN-003 extended), then the order: edits' `sortAfter` and manual lines' `sortHint`. */
export function applyOverrides(result: BoqResult, overrides: OverrideRec[], items: ManualItemRec[], lists: CodeLists) {
  const lines = result.lines as EditedLine[];
  const byKey = new Map(lines.map((l) => [l.key, l]));
  for (const o of overrides) {
    const line = byKey.get(o.lineKey);
    if (!line) continue;
    const ov: NonNullable<EditedLine["overridden"]> = { fields: [] };
    if (o.quantity !== undefined) {
      ov.fields.push("quantity");
      ov.engineQuantity = line.quantity;
      ov.quantity = o.quantity;
      line.quantity = o.quantity;
      // "Mark as to confirm": no quantity, flagged like any line waiting for a value.
      if (o.quantity === null) line.source = "flagged";
    }
    if (o.unit !== undefined) {
      ov.fields.push("unit");
      ov.engineUnit = line.unit;
      line.unit = o.unit as BoqLine["unit"];
    }
    if (o.description !== undefined) {
      ov.fields.push("description");
      ov.engineDescription = line.description;
      line.description = o.description;
    }
    if (o.codes && Object.keys(o.codes).length) {
      ov.fields.push("codes");
      ov.engineCodes = {};
      for (const [system, code] of Object.entries(o.codes)) {
        ov.engineCodes[system] = line.codes[system]?.code ?? null;
        const lc = lineCode(system, code, lists);
        if (lc) line.codes[system] = lc;
      }
    }
    if (o.excluded) {
      ov.fields.push("excluded");
      line.excluded = true;
    }
    if (o.sortAfter !== undefined) ov.fields.push("order");
    if (o.reason) ov.reason = o.reason;
    if (ov.fields.length) line.overridden = ov;
  }

  const primary = Object.keys(lines.find((l) => Object.keys(l.codes).length)?.codes ?? {})[0];
  const section = (l: BoqLine) => (primary ? (l.codes[primary]?.path.map((p) => p.code).join("/") ?? "") : "");
  const moves: [string, string | null][] = [
    ...items.filter((i) => i.sortHint).map((i) => [i.item.id, i.sortHint!] as [string, string]),
    ...overrides.filter((o) => o.sortAfter !== undefined).map((o) => [o.lineKey, o.sortAfter!] as [string, string | null]),
  ];
  for (const [key, after] of moves) {
    const from = lines.findIndex((l) => l.key === key);
    if (from < 0) continue;
    const [line] = lines.splice(from, 1);
    let to: number;
    if (after === null) {
      const first = lines.findIndex((l) => section(l) === section(line!));
      to = first < 0 ? from : first;
    } else {
      const target = lines.findIndex((l) => l.key === after);
      to = target < 0 ? from : target + 1;
    }
    lines.splice(to, 0, line!);
  }
}

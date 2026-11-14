/**
 * Position numbers on the sheet (F06 §13, P30, BR-28): the section's code in the Group-by system plus
 * a running number in the order the sheet shows, with the code list's separator (`.` when it has
 * none); excluded lines get none, lines without a code count under `0`; with no system, 1, 2, 3 …
 * The sheet numbers what it shows, so the working version renumbers at once as lines are added,
 * moved, reordered or excluded. The same rule as the backend's `positionNo` (apps/mock-api
 * `positions.ts`); a saved version shows the frozen run with its frozen edits, so its numbers stay.
 */
import { buildRows } from "./model";
import type { SheetLine } from "./edits";

export function positionNumbers(lines: readonly SheetLine[], system: string | null, separator = "."): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const counters = new Map<string, number>();
  let plain = 0;
  for (const row of buildRows([...lines], system)) {
    if (row.kind !== "line" || row.line.excluded) continue;
    const line = row.line;
    if (!system) {
      out.set(line.key, String(++plain));
      continue;
    }
    const section = line.codes[system]?.code ?? "0";
    const n = (counters.get(section) ?? 0) + 1;
    counters.set(section, n);
    out.set(line.key, `${section}${separator || "."}${n}`);
  }
  return out;
}

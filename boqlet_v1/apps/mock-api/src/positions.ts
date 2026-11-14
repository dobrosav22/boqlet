/**
 * Position numbers (F06 §13, P30, BR-28): each line's number inside its section of the grouping
 * system, the section's code plus a running number in line order (`5.1`, `D.01.1`), with the code
 * list's separator (`.` when it has none). Excluded lines get no number; lines without a code in the
 * system count under `0`. With no grouping system the lines are numbered 1, 2, 3 …
 *
 * The app numbers its sheet with the same rule (`features/boq-sheet/positions.ts`), so the working
 * version renumbers at once while edits are made; this is the backend's number (exports, saved versions).
 */
export interface NumberedLine {
  key: string;
  code: string | null;
  excluded: boolean;
}

export function positionNumbers(lines: readonly NumberedLine[], opts: { grouped: boolean; separator?: string }): Map<string, string> {
  const sep = opts.separator || ".";
  const counters = new Map<string, number>();
  const out = new Map<string, string>();
  let plain = 0;
  for (const line of lines) {
    if (line.excluded) continue;
    if (!opts.grouped) {
      out.set(line.key, String(++plain));
      continue;
    }
    const section = line.code ?? "0";
    const n = (counters.get(section) ?? 0) + 1;
    counters.set(section, n);
    out.set(line.key, `${section}${sep}${n}`);
  }
  return out;
}

/** Lines in section order: engine order, then each line with `sortAfter` placed after that line (`null`: first). */
export function orderedForNumbers<L extends { key: string; sortAfter?: string | null }>(lines: readonly L[]): L[] {
  const out = [...lines];
  const keys = new Set(out.map((l) => l.key));
  for (const line of lines.filter((l) => l.sortAfter !== undefined && (l.sortAfter === null || (keys.has(l.sortAfter) && l.sortAfter !== l.key)))) {
    out.splice(out.indexOf(line), 1);
    out.splice(line.sortAfter === null ? 0 : out.findIndex((l) => l.key === line.sortAfter) + 1, 0, line);
  }
  return out;
}

/**
 * "Diff two versions as JSON diff" (F10 §5; a structured diff comes later): both documents printed
 * with sorted keys, compared line by line. The common start and end are trimmed first, and the rest
 * goes through a longest-common-subsequence table when it is small enough; a huge middle (a whole
 * code list replaced) is shown as removed and added.
 */

export type DiffOp = "same" | "removed" | "added";
export interface DiffLine {
  op: DiffOp;
  text: string;
  /** Line numbers in the older (a) and newer (b) document, 1-based. */
  a?: number;
  b?: number;
}
export type DiffRow = DiffLine | { op: "skip"; count: number };

const MAX_CELLS = 4_000_000;

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sorted((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** A document as the lines the diff compares: pretty JSON with keys in order. */
export const jsonLines = (doc: unknown): string[] => (JSON.stringify(sorted(doc), null, 2) ?? "null").split("\n");

export function diffLines(a: string[], b: string[]): DiffLine[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ op: "same", text: a[i]!, a: i + 1, b: i + 1 });
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > MAX_CELLS) {
    midA.forEach((text, i) => out.push({ op: "removed", text, a: start + i + 1 }));
    midB.forEach((text, j) => out.push({ op: "added", text, b: start + j + 1 }));
  } else {
    // lcs[i][j]: the longest common subsequence of midA[i..] and midB[j..].
    const n = midA.length;
    const m = midB.length;
    const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = midA[i] === midB[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) {
        out.push({ op: "same", text: midA[i]!, a: start + i + 1, b: start + j + 1 });
        i++;
        j++;
      } else if (j < m && (i === n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
        out.push({ op: "added", text: midB[j]!, b: start + j + 1 });
        j++;
      } else {
        out.push({ op: "removed", text: midA[i]!, a: start + i + 1 });
        i++;
      }
    }
  }
  const offA = a.length - endA;
  for (let k = 0; k < offA; k++) out.push({ op: "same", text: a[endA + k]!, a: endA + k + 1, b: endB + k + 1 });
  return out;
}

/** Unchanged runs longer than twice `context` collapse to a "skip" row between their edges. */
export function withContext(lines: DiffLine[], context = 3): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.op !== "same") {
      rows.push(lines[i]!);
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j]!.op === "same") j++;
    const head = i === 0 ? 0 : context;
    const tail = j === lines.length ? 0 : context;
    if (j - i > head + tail + 1) {
      rows.push(...lines.slice(i, i + head), { op: "skip", count: j - i - head - tail }, ...lines.slice(j - tail, j));
    } else rows.push(...lines.slice(i, j));
    i = j;
  }
  return rows;
}

export function diffDocs(older: unknown, newer: unknown) {
  const lines = diffLines(jsonLines(older), jsonLines(newer));
  return {
    rows: withContext(lines),
    added: lines.filter((l) => l.op === "added").length,
    removed: lines.filter((l) => l.op === "removed").length,
  };
}

/**
 * Formulas in words, ported as is from the PoC (`apps/web/src/library/readable.ts`,
 * reuse-from-poc.md): `(src.length + 2 * p.working_space) * src.height` is shown and edited as
 * `([Length] + 2 * [Working space]) * [Height]`, and turned back into names when edited.
 *
 * This only renames: names outside string literals become `[Label]` (a path becomes
 * `[Openings › Area]`, a slot its label), and back. Nothing is parsed or evaluated here; the
 * engine stays the only place that reads formulas (BR-01, CLAUDE.md rule 4). `src.` is left out,
 * because calculated items see the source's fields under their own names too.
 *
 * The one change from the PoC: labels come from the caller (the message catalogue), not from
 * `vocab.ts`.
 */
import type { Param } from "@ifc-boq/types";
import { NAMES } from "./names";

const SEP = " › ";
const KEYWORDS = new Set(["AND", "OR", "NOT", "WHERE", "TRUE", "FALSE", "NULL"]);
const PATH = /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/y;
const RAW_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const identChar = (c: string | undefined) => !!c && /[A-Za-z0-9_.]/.test(c);

export interface Lexicon {
  /** `[Label]` for a name or path, or null when it has no label (it is then shown as written). */
  toLabel: (path: string) => string | null;
  /** The name for the text inside `[ ]`, or null when nothing has that label. */
  fromLabel: (text: string) => string | null;
  /** Slot name -> the label it is shown with (slots whose label clashes keep `p.name`). */
  slotLabels: Map<string, string>;
}

/** `labelOf(name)` gives a name's label in the user's language (e.g. from `library.names`). */
export function lexicon(slots: Record<string, Param>, labelOf: (name: string) => string): Lexicon {
  const byName = new Map(NAMES.map((n) => [n, labelOf(n)]));
  const byLabel = new Map(NAMES.map((n) => [labelOf(n).toLowerCase(), n]));
  const slotLabels = new Map<string, string>();
  const slotByLabel = new Map<string, string>();
  for (const [k, p] of Object.entries(slots)) {
    if (p.type === "formula") continue; // a formula slot is not a value another formula can read
    const label = (p.label || "").trim();
    const key = label.toLowerCase();
    if (!label || /[[\]›"]/.test(label) || byLabel.has(key) || slotByLabel.has(key)) continue;
    slotLabels.set(k, label);
    slotByLabel.set(key, k);
  }
  return {
    slotLabels,
    toLabel(path) {
      let segs = path.split(".");
      if (segs[0] === "src" && segs.length > 1) segs = segs.slice(1);
      if (segs[0] === "p" && segs.length === 2) {
        const l = slotLabels.get(segs[1]!);
        return l ? `[${l}]` : null;
      }
      const labels = segs.map((s) => byName.get(s));
      return labels.every(Boolean) ? `[${labels.join(SEP)}]` : null;
    },
    fromLabel(text) {
      const t = text.trim();
      const slot = slotByLabel.get(t.toLowerCase());
      if (slot) return `p.${slot}`;
      const names = t.split("›").map((x) => byLabel.get(x.trim().toLowerCase()));
      if (names.every(Boolean)) return names.join(".");
      // a name written out in brackets: [p.some_slot], [length], [src.faces.side]
      if (!RAW_PATH.test(t)) return null;
      const segs = t.split(".");
      if (segs[0] === "p") return segs.length === 2 && segs[1]! in slots ? t : null;
      return byName.has(segs[segs[0] === "src" ? 1 : 0] ?? "") ? t : null;
    },
  };
}

/** Index just past the string literal starting at i (a `"`), honouring backslash escapes. */
function endOfString(s: string, i: number): number {
  let j = i + 1;
  while (j < s.length && s[j] !== '"') j += s[j] === "\\" ? 2 : 1;
  return Math.min(j + 1, s.length);
}

export function toReadable(raw: string, lex: Lexicon): string {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    const c = raw[i]!;
    if (c === '"') {
      const j = endOfString(raw, i);
      out += raw.slice(i, j);
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c) && !identChar(raw[i - 1])) {
      PATH.lastIndex = i;
      const path = PATH.exec(raw)![0];
      const next = raw.slice(i + path.length).trimStart()[0];
      const fixed = next === "(" || KEYWORDS.has(path.toUpperCase());
      out += (!fixed && lex.toLabel(path)) || path;
      i += path.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * The formula with every `[Label]` replaced by its name, or the first label nothing answers to.
 * `unknown(label)` words the error (the caller's catalogue); `unclosed(text)` the missing `]`.
 */
export function fromReadable(
  text: string,
  lex: Lexicon,
  errors: { unclosed: (text: string) => string; unknown: (label: string) => string },
): { raw: string } | { error: string } {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const j = endOfString(text, i);
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (c === "[" && text.slice(i + 1).trimStart()[0] !== '"') {
      const j = text.indexOf("]", i);
      if (j < 0) return { error: errors.unclosed(text.slice(i, i + 24)) };
      const name = lex.fromLabel(text.slice(i + 1, j));
      if (!name) return { error: errors.unknown(text.slice(i, j + 1)) };
      out += name;
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return { raw: out };
}

/** Same formula apart from spacing and `src.` (which calculated items do not need). */
export const sameFormula = (a: string, b: string) => {
  const norm = (s: string) => s.replace(/\bsrc\./g, "").replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
};

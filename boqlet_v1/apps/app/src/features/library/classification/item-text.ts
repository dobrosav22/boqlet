/**
 * Item texts (F10 §13, P14, BR-11): a code's `description` is the written description of the BoQ
 * item that is priced, a template with blanks (`{thickness}`, `{thickness*1000}`, `{expr: …}`, the
 * same syntax as a rule's line text). The engine fills them (BR-01); here they are only read back:
 * as pieces (plain text and blanks), and as a sample filled by plain substitution from one line of
 * the preview, as the mock does (`fillItemText`, mock-api). Expressions are never evaluated: they
 * stay as written.
 */
import type { ClassificationMap } from "@ifc-boq/types";
import type { PreviewResult } from "@/api/hooks/library";
import { LINE_SPLITS } from "../shared/vocab";
import { outcomeFor, sourceCode, type LineKind } from "./model";

export type PreviewLine = PreviewResult["lines"][number];

/** The names an item text's insert buttons offer: the values a line can carry, its unit and quantity. */
export const ITEM_TEXT_NAMES: readonly string[] = [...LINE_SPLITS, "unit", "quantity"];

/** A piece of an item text: plain text, or a blank (as written, braces included). */
export type ItemTextPiece =
  | { text: string }
  | {
      /** The blank as written, e.g. `{thickness}` or `{expr: …}`. */
      blank: string;
      /** For a plain `{name}`: the name. Expressions have none (the engine fills them). */
      name?: string;
      /** The sample line's value for the name, when it has one. */
      value?: string;
    };

const BLANK = /\{([^{}]*)\}/g;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A line's value for a plain blank: its line keys, then its unit and quantity (as the mock fills them). */
export function lineValue(line: PreviewLine, name: string): string | undefined {
  const keyed = (line.keys as Record<string, unknown> | undefined)?.[name];
  if (keyed !== undefined && keyed !== null && keyed !== "" && typeof keyed !== "object") return String(keyed);
  if (name === "unit" && line.unit) return line.unit;
  if (name === "quantity" && line.quantity !== null && line.quantity !== undefined) return String(line.quantity);
  return undefined;
}

/** The template as pieces; with a line, plain blanks carry that line's values. */
export function itemTextPieces(template: string, line?: PreviewLine | null): ItemTextPiece[] {
  const out: ItemTextPiece[] = [];
  let last = 0;
  for (const m of template.matchAll(BLANK)) {
    if (m.index > last) out.push({ text: template.slice(last, m.index) });
    const inner = m[1]!.trim();
    const name = NAME.test(inner) ? inner : undefined;
    const value = name && line ? lineValue(line, name) : undefined;
    out.push({ blank: m[0], ...(name ? { name } : {}), ...(value !== undefined ? { value } : {}) });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ text: template.slice(last) });
  return out;
}

/** The template filled with a line's values; blanks it has no value for, and expressions, stay as written. */
export const fillItemText = (template: string, line: PreviewLine): string =>
  itemTextPieces(template, line)
    .map((p) => ("text" in p ? p.text : (p.value ?? p.blank)))
    .join("");

/** The plain names an item text uses. */
export const itemTextNames = (template: string): string[] => [...new Set(itemTextPieces(template).flatMap((p) => ("name" in p && p.name ? [p.name] : [])))];

/**
 * Put `{name}` in place of the selection (or at the cursor), with a space before it when it would
 * stick to a word. Returns the new text and where the cursor goes.
 */
export function insertBlank(text: string, name: string, start = text.length, end = start): { text: string; caret: number } {
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  const before = text.slice(0, a);
  const piece = `${before && !/[\s(]$/.test(before) ? " " : ""}{${name}}`;
  return { text: before + piece + text.slice(b), caret: a + piece.length };
}

/**
 * The code lines of one BoQ item get for sure (the rule every line of it falls to), following
 * "same as its source" one step for calculated items. Conditions are never evaluated, so a code
 * only some of its lines get (a split row) is not counted.
 */
export function codeForItem(map: ClassificationMap, kind: LineKind, kinds: LineKind[]): string | undefined {
  const base = outcomeFor(map, kind).base;
  if (!base) return undefined;
  if (typeof base.code === "string") return base.code || undefined;
  if ("fromSource" in base.code) return sourceCode(map, kind, kinds);
  return undefined;
}

/**
 * For each code, the first preview line that gets it (by its BoQ item: a map rule `{ruleId}` →
 * the code, or any other rule aimed at that item for sure). A line's item is looked up in `kinds`
 * (for its tags); an item the chosen rule set doesn't have is matched by its id alone.
 */
export function sampleLines(map: ClassificationMap, lines: PreviewLine[], kinds: LineKind[] = []): Map<string, PreviewLine> {
  const byId = new Map(kinds.map((k) => [k.id, k]));
  const codeOf = new Map<string, string | undefined>();
  const out = new Map<string, PreviewLine>();
  for (const line of lines) {
    if (!codeOf.has(line.ruleId)) {
      const kind = byId.get(line.ruleId) ?? { id: line.ruleId, label: line.ruleId, group: "item", tags: [] };
      codeOf.set(line.ruleId, codeForItem(map, kind, kinds));
    }
    const code = codeOf.get(line.ruleId);
    if (code && !out.has(code)) out.set(code, line);
  }
  return out;
}

/** The first preview line of each BoQ item. */
export function firstLineByItem(lines: PreviewLine[]): Map<string, PreviewLine> {
  const out = new Map<string, PreviewLine>();
  for (const line of lines) if (!out.has(line.ruleId)) out.set(line.ruleId, line);
  return out;
}

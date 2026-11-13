/**
 * Fake "Item texts filled" (mock-api.md, replaced by EN-010): after a run, each line's code in each
 * system gets `text`, the code's item text (`description`) with its `{name}` blanks filled by plain
 * substitution from the line's values (its line keys, then its unit and quantity). A blank the line
 * has no value for stays visible as written. Expressions (`{thickness*1000}`, `{expr: …}`) are left
 * as written, and no `item_text_blank` warning is raised: both come with EN-010. Nothing is measured
 * (BR-01): a value is copied as the engine gave it.
 */
import type { BoqResult } from "@ifc-boq/types";
import type { CodeLists } from "../../codes.js";

const BLANK = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** The template with the line's values in its simple blanks. */
export function fillItemText(template: string, line: BoqResult["lines"][number]): string {
  return template.replace(BLANK, (whole, name: string) => {
    const keyed = line.keys?.[name];
    if (keyed !== undefined && keyed !== null && keyed !== "") return String(keyed);
    if (name === "unit") return String(line.unit);
    if (name === "quantity" && line.quantity !== null) return String(line.quantity);
    return whole;
  });
}

export function addItemTexts(result: BoqResult, lists: CodeLists): void {
  for (const line of result.lines) {
    for (const [system, code] of Object.entries(line.codes ?? {})) {
      const template = lists.get(system)?.get(code.code)?.description;
      if (template) code.text = fillItemText(template, line);
      else delete code.text;
    }
  }
}

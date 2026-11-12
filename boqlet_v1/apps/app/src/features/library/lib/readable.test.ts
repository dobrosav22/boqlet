import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Param } from "@ifc-boq/types";
import messages from "../../../../messages/en/library.json";
import { NAMES } from "./names";
import { fromReadable, lexicon, sameFormula, toReadable } from "./readable";

/** The port of the PoC's readable formulas, against the shipped `as-modelled` rule set (reuse-from-poc.md rule 1). */

const PRESETS = path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "presets");
const asModelled = JSON.parse(readFileSync(path.join(PRESETS, "rules", "as-modelled.json"), "utf8")) as { params: Record<string, Param> };
const labels = messages.names as Record<string, { label: string }>;
const labelOf = (name: string) => labels[name]!.label;
const lex = lexicon(asModelled.params, labelOf);
const errors = { unclosed: (t: string) => `unclosed ${t}`, unknown: (l: string) => `unknown ${l}` };

/** Every formula string in a document. */
function formulas(o: unknown, out: string[] = []): string[] {
  if (Array.isArray(o)) o.forEach((v) => formulas(v, out));
  else if (o && typeof o === "object")
    for (const [k, v] of Object.entries(o)) {
      if ((k === "formula" || k === "expr" || k === "expression") && typeof v === "string") out.push(v);
      else formulas(v, out);
    }
  return out;
}

describe("readable formulas (ported from the PoC)", () => {
  it("every name has a label in the catalogue", () => {
    expect(NAMES.filter((n) => !labels[n]?.label)).toEqual([]);
  });

  it("shows names as labels and slots by their label", () => {
    expect(toReadable("2 * (width + height)", lex)).toBe("2 * ([Width] + [Height])");
    expect(toReadable("SUM(src.layers.area WHERE UNDER(material, \"board.plasterboard\"))", lex)).toBe('SUM([Layers › Area] WHERE UNDER([Material], "board.plasterboard"))');
    const slot = [...lex.slotLabels.entries()][0]!;
    expect(toReadable(`p.${slot[0]} * 2`, lex)).toBe(`[${slot[1]}] * 2`);
  });

  it("leaves functions, keywords, string literals and unknown names as written", () => {
    expect(toReadable('area (main, net) AND status = "existing"', lex)).toBe('area (main, net) AND [Status] = "existing"');
    expect(toReadable("mystery_value", lex)).toBe("mystery_value");
  });

  it("round-trips every formula of the as-modelled rule set", () => {
    const all = formulas(asModelled);
    expect(all.length).toBeGreaterThan(3);
    for (const raw of all) {
      const back = fromReadable(toReadable(raw, lex), lex, errors);
      expect("raw" in back && sameFormula(back.raw, raw)).toBe(true);
    }
  });

  it("names the first label nothing answers to", () => {
    expect(fromReadable("[No such name] * 2", lex, errors)).toEqual({ error: "unknown [No such name]" });
    expect(fromReadable("[Width", lex, errors)).toEqual({ error: "unclosed [Width" });
  });
});

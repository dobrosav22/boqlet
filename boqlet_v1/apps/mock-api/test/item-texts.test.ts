import { describe, expect, it } from "vitest";
import type { BoqResult } from "@ifc-boq/types";
import { exportedResult } from "../src/engine/fakes/export-xlsx.js";
import { addItemTexts, fillItemText } from "../src/engine/fakes/item-texts.js";
import type { CodeLists } from "../src/codes.js";

/** The "Item texts filled" fake (FE-027, until EN-010) and item texts in the export (F06 §2). */

const line = (key: string, extra: Record<string, unknown> = {}) =>
  ({ key, description: `Wall ${key}`, unit: "m2", quantity: 10, notes: [] as string[], keys: { type_name: "Brick on Block", thickness: 0.417 }, codes: {}, ...extra }) as unknown as BoqResult["lines"][number];

describe("item texts (fake)", () => {
  it("fills simple blanks from the line's keys, unit and quantity; leaves unknown blanks and expressions visible", () => {
    expect(fillItemText("External walls {type_name}, {thickness} thick, per {unit}", line("a"))).toBe("External walls Brick on Block, 0.417 thick, per m2");
    expect(fillItemText("{fire_rating} and {thickness*100} cm", line("a"))).toBe("{fire_rating} and {thickness*100} cm");
  });

  it("puts the filled text on each line's code that has an item text, and only there", () => {
    const lists: CodeLists = new Map([["sys", new Map([["1", { code: "1", title: "Walls", description: "Walls {type_name}" }], ["2", { code: "2", title: "Other" }]])]]);
    const result = {
      lines: [line("a", { codes: { sys: { system: "sys", code: "1", title: "Walls", path: [], source: "map" } } }), line("b", { codes: { sys: { system: "sys", code: "2", title: "Other", path: [], source: "map" } } })],
    } as unknown as BoqResult;
    addItemTexts(result, lists);
    expect(result.lines[0]!.codes.sys!.text).toBe("Walls Brick on Block");
    expect(result.lines[1]!.codes.sys!.text).toBeUndefined();
  });

  it("the export's Description is the grouping system's item text, with what was measured in the notes; an edited description wins", () => {
    const result = {
      lines: [
        line("a", { codes: { sys: { code: "1", text: "Walls Brick on Block" } } }),
        line("b", { codes: { sys: { code: "1", text: "Walls Brick on Block" } }, overridden: { fields: ["description"], engineDescription: "Wall b" }, description: "My words" }),
      ],
    } as unknown as BoqResult;
    const out = exportedResult(result, "sys");
    expect(out.lines[0]).toMatchObject({ description: "Walls Brick on Block", notes: ["Measured as: Wall a"] });
    expect(out.lines[1]!.description).toBe("My words");
    expect(exportedResult(result).lines[0]!.description).toBe("Wall a");
  });
});

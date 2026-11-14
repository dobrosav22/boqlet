import { describe, expect, it } from "vitest";
import type { RunLine } from "@/api/hooks/sheet";
import type { SheetLine } from "./edits";
import { positionNumbers } from "./positions";

let n = 0;
function line(code: string | null, fields: Partial<SheetLine> = {}): SheetLine {
  const i = n++;
  return {
    key: `l${i}`,
    ruleId: "r",
    ruleKind: "item",
    description: `Line ${i}`,
    unit: "m2",
    quantity: 1,
    source: "measured",
    keys: {},
    trace: { formula: "x", params: {}, elements: [] },
    codes: code ? { acme: { system: "acme", code, title: code, path: code.split(".").map((_, k, all) => ({ code: all.slice(0, k + 1).join("."), title: "" })), source: "map" } } : {},
    tags: [],
    notes: [],
    sortIndex: i,
    ...fields,
  } as RunLine as SheetLine;
}

describe("position numbers on the sheet (F06 §13, BR-28)", () => {
  it("numbers each section from 1 in the order shown; excluded lines get none; no code counts under 0", () => {
    const [a, b, c, d, e] = [line("5"), line("5"), line("5", { excluded: true }), line(null), line("5")];
    const numbers = positionNumbers([a!, b!, c!, d!, e!], "acme");
    expect([a, b, c, d, e].map((l) => numbers.get(l!.key) ?? null)).toEqual(["5.1", "5.2", null, "0.1", "5.3"]);
  });

  it("renumbers at once after a move and after an exclusion", () => {
    const [a, b, c] = [line("2.1"), line("2.1"), line("2.1")];
    const moved = positionNumbers([a!, b!, { ...c!, sortAfter: null }], "acme");
    expect([c, a, b].map((l) => moved.get(l!.key))).toEqual(["2.1.1", "2.1.2", "2.1.3"]);
    const excluded = positionNumbers([{ ...a!, excluded: true }, b!, c!], "acme");
    expect([b, c].map((l) => excluded.get(l!.key))).toEqual(["2.1.1", "2.1.2"]);
  });

  it("uses the code list's separator; without a system the lines are numbered 1, 2, 3", () => {
    const [a, b] = [line("EF_25"), line("EF_25")];
    expect(positionNumbers([a!, b!], "acme", "_").get(b!.key)).toBe("EF_25_2");
    expect([...positionNumbers([a!, b!], null).values()]).toEqual(["1", "2"]);
  });
});

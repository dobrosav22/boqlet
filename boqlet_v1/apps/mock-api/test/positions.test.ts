import { describe, expect, it } from "vitest";
import { orderedForNumbers, positionNumbers } from "../src/positions.js";

describe("position numbers (F06 §13, BR-28)", () => {
  it("numbers each section from 1 in line order, skipping excluded lines; no code counts under 0", () => {
    const lines = [
      { key: "a", code: "5", excluded: false },
      { key: "b", code: "D.01", excluded: false },
      { key: "c", code: "5", excluded: true },
      { key: "d", code: "5", excluded: false },
      { key: "e", code: null, excluded: false },
      { key: "f", code: "D.01", excluded: false },
    ];
    expect(Object.fromEntries(positionNumbers(lines, { grouped: true }))).toEqual({ a: "5.1", b: "D.01.1", d: "5.2", e: "0.1", f: "D.01.2" });
    expect(positionNumbers(lines, { grouped: true, separator: "_" }).get("b")).toBe("D.01_1");
    expect(Object.fromEntries(positionNumbers(lines, { grouped: false }))).toEqual({ a: "1", b: "2", d: "3", e: "4", f: "5" });
  });

  it("a moved line takes its new place before numbering", () => {
    const ordered = orderedForNumbers([{ key: "a" }, { key: "b" }, { key: "c", sortAfter: null }, { key: "d", sortAfter: "a" }]);
    expect(ordered.map((l) => l.key)).toEqual(["c", "a", "d", "b"]);
  });
});

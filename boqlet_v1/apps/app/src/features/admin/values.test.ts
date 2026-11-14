import { describe, expect, it } from "vitest";
import { parseOverrideValue, parseTags } from "./values";

describe("override values", () => {
  it("reads numbers and booleans; empty removes the override", () => {
    expect(parseOverrideValue("40")).toBe(40);
    expect(parseOverrideValue(" 2.5 ")).toBe(2.5);
    expect(parseOverrideValue("true")).toBe(true);
    expect(parseOverrideValue("false")).toBe(false);
    expect(parseOverrideValue("")).toBeNull();
    expect(parseOverrideValue("  ")).toBeNull();
  });

  it("refuses anything else", () => {
    for (const v of ["ten", "1e3", "0x10", "40 seats", "TRUE"]) expect(parseOverrideValue(v)).toBeUndefined();
  });
});

describe("tags", () => {
  it("splits on commas, trims, drops empties and duplicates", () => {
    expect(parseTags(" lead, demo,,lead , ")).toEqual(["lead", "demo"]);
    expect(parseTags("")).toEqual([]);
  });
});

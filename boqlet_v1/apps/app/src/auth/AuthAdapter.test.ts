import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./AuthAdapter";

describe("safeReturnTo", () => {
  it("keeps same-site paths", () => {
    expect(safeReturnTo("/studio-demo/projects?x=1")).toBe("/studio-demo/projects?x=1");
  });
  it("refuses other sites and odd values", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeReturnTo(bad)).toBe("/");
    }
  });
});

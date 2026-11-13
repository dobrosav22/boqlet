import { describe, expect, it } from "vitest";
import { diffDocs, diffLines, jsonLines, withContext } from "./json-diff";

describe("json diff of two preset versions", () => {
  it("prints keys in order, so key order never shows as a change", () => {
    expect(jsonLines({ b: 1, a: { d: 2, c: 3 } })).toEqual(jsonLines({ a: { c: 3, d: 2 }, b: 1 }));
    expect(diffDocs({ b: 1, a: 2 }, { a: 2, b: 1 })).toMatchObject({ added: 0, removed: 0 });
  });

  it("marks changed, added and removed lines with their line numbers", () => {
    const lines = diffLines(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"]);
    expect(lines).toEqual([
      { op: "same", text: "a", a: 1, b: 1 },
      { op: "added", text: "x", b: 2 },
      { op: "removed", text: "b", a: 2 },
      { op: "same", text: "c", a: 3, b: 3 },
      { op: "same", text: "d", a: 4, b: 4 },
      { op: "added", text: "e", b: 5 },
    ]);
  });

  it("a changed setting in a rule-set patch is one line removed and one added", () => {
    const v1 = { id: "studio-rules", params: { wall_opening_threshold: { value: 0.5 }, window_measure: { value: "area" } } };
    const v2 = { id: "studio-rules", params: { wall_opening_threshold: { value: 1 }, window_measure: { value: "area" } } };
    const { added, removed, rows } = diffDocs(v1, v2);
    expect([added, removed]).toEqual([1, 1]);
    expect(rows.filter((r) => r.op !== "same" && r.op !== "skip").map((r) => (r as { text: string }).text.trim())).toEqual(['"value": 1', '"value": 0.5']);
  });

  it("collapses long unchanged runs but keeps context around changes", () => {
    const a = Array.from({ length: 30 }, (_, i) => `l${i}`);
    const b = [...a];
    b[15] = "changed";
    const rows = withContext(diffLines(a, b), 3);
    expect(rows[0]).toEqual({ op: "skip", count: 12 });
    expect(rows.filter((r) => r.op === "same")).toHaveLength(6);
    expect(rows.at(-1)).toEqual({ op: "skip", count: 11 });
  });

  it("shows a huge replaced middle as removed and added without building the table", () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`);
    const lines = diffLines(a, b);
    expect(lines.filter((l) => l.op === "removed")).toHaveLength(3000);
    expect(lines.filter((l) => l.op === "added")).toHaveLength(3000);
  });
});

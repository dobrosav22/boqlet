import { describe, expect, it } from "vitest";
import type { LineChange } from "@/api/hooks/diffs";
import { candidates, groupLines, groupsIn, passes, DEFAULT_THRESHOLD } from "./model";

/** F08 §3–4, §6 in the Changes tab (FE-030): filters, grouping like the sheet, what to compare with. */

const codes = (top: string) => ({ s: { system: "s", code: `${top}.1`, title: "x", path: [{ code: top, title: `Group ${top}` }], source: "map" } });
const line = (key: string, change: LineChange["change"], before: number | null, after: number | null, top = "02", text = key): LineChange => ({
  lineKey: key,
  change,
  ...(change !== "added" ? { before: { quantity: before, unit: "m2", description: text, codes: codes(top) } } : {}),
  ...(change !== "removed" ? { after: { quantity: after, unit: "m2", description: text, codes: codes(top) } } : {}),
  delta: before !== null && after !== null ? after - before : null,
  deltaPct: before && after !== null ? ((after - before) / before) * 100 : null,
  causes: [],
});

describe("filters (F08 §4)", () => {
  const f = { minDeltaPct: DEFAULT_THRESHOLD };
  it("hides changed lines under the threshold, never added or removed ones, nor text changes", () => {
    expect(passes(line("a", "changed", 100, 100.5), f, "s")).toBe(false);
    expect(passes(line("a", "changed", 100, 101), f, "s")).toBe(true);
    expect(passes(line("a", "changed", 100, 99), f, "s")).toBe(true);
    expect(passes(line("b", "added", null, 1), f, "s")).toBe(true);
    expect(passes(line("c", "removed", 1, null), f, "s")).toBe(true);
    const text: LineChange = { ...line("d", "changed", 100, 100), after: { quantity: 100, unit: "m2", description: "renamed", codes: codes("02") } };
    expect(passes(text, f, "s")).toBe(true);
    expect(passes(line("a", "changed", 100, 100.5), { minDeltaPct: 0 }, "s")).toBe(true);
  });
  it("by change type and by group", () => {
    expect(passes(line("b", "added", null, 1), { ...f, change: "removed" }, "s")).toBe(false);
    expect(passes(line("b", "added", null, 1, "03"), { ...f, group: "03" }, "s")).toBe(true);
    expect(passes(line("b", "added", null, 1, "03"), { ...f, group: "02" }, "s")).toBe(false);
  });
});

describe("grouping like the sheet", () => {
  it("keeps the report's order, groups by the top-level code", () => {
    const lines = [line("a", "added", null, 1, "02"), line("b", "added", null, 1, "05"), line("c", "removed", 1, null, "02")];
    expect(groupLines(lines, "s").map((g) => [g.code, g.lines.map((l) => l.lineKey)])).toEqual([
      ["02", ["a", "c"]],
      ["05", ["b"]],
    ]);
    expect(groupsIn(lines, "s")).toEqual([
      { code: "02", title: "Group 02", count: 2 },
      { code: "05", title: "Group 05", count: 1 },
    ]);
    expect(groupLines(lines, null).map((g) => g.code)).toEqual([""]);
  });
});

describe("what to compare with (F08 §3, §6)", () => {
  const run = (id: string, status = "complete") => ({ id, status, createdAt: "2026-11-01T10:00:00Z", finishedAt: "2026-11-01T10:01:00Z" });
  it("saved versions first, then earlier runs, then other BoQs; the last saved version by default", () => {
    const { list, defaultRunId } = candidates({
      currentRunId: "r3",
      revisions: [
        { id: "B", label: "B", status: "draft", currentRun: run("r3") },
        { id: "A", label: "A", status: "issued", currentRun: run("r1") },
      ],
      runs: [run("r3"), run("r2"), run("r0", "failed"), run("r1")],
      otherBoqs: [{ name: "Cost check", currentRun: run("x1") }, { name: "Empty", currentRun: null }],
      basedOnRevisionId: "A",
    });
    expect(list.map((c) => [c.kind, c.runId])).toEqual([
      ["saved", "r1"],
      ["earlier", "r2"],
      ["boq", "x1"],
    ]);
    expect(defaultRunId).toBe("r1");
  });
  it("before the first save: no default, earlier runs offered", () => {
    const { list, defaultRunId } = candidates({ currentRunId: "r2", revisions: [{ id: "A", label: "A", status: "draft", currentRun: run("r2") }], runs: [run("r2"), run("r1")], otherBoqs: [], basedOnRevisionId: null });
    expect(defaultRunId).toBeNull();
    expect(list.map((c) => c.runId)).toEqual(["r1"]);
  });
});

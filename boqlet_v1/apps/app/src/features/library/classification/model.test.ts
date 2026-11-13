import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import type { ClassificationMap, Code, CodeList, RuleSet } from "@ifc-boq/types";
import messages from "../../../../messages/en/classificationEditor.json";
import { aimed, codeUsage, coverage, fits, lineKinds, mergeCodes, newCode, outcomeFor, pageOf, PAGE_SIZE, parseWhere, readTable, renameCode, sourceCode, suggest, treeOrder, viaAdvanced, writeRow, type LineKind } from "./model";

const map = (rules: ClassificationMap["rules"], extra: Partial<ClassificationMap> = {}): ClassificationMap => ({
  schemaVersion: "1.0",
  id: "m",
  name: "M",
  version: "1",
  codeList: "c",
  rules,
  onUnmapped: "flag",
  onConflict: "first",
  ...extra,
});

const ruleSet = {
  items: [
    { id: "walls", label: "Walls", tags: ["wall"] },
    { id: "slabs", label: "", tags: [] },
  ],
  derived: [{ id: "formwork-walls", label: "Formwork to walls", from: ["walls"], tags: ["formwork"] }],
  manual: [{ id: "prelims", description: "Preliminaries", kind: "preliminary" }],
} as unknown as RuleSet;

const kinds = lineKinds(ruleSet);
const walls = kinds[0]!;
const formwork = kinds.find((k) => k.id === "formwork-walls")!;
const prelims = kinds.find((k) => k.id === "prelims")!;

describe("line kinds", () => {
  it("lists items, derived and hand-entered items with their labels", () => {
    expect(kinds.map((k) => [k.id, k.label, k.group])).toEqual([
      ["walls", "Walls", "item"],
      ["slabs", "slabs", "item"],
      ["formwork-walls", "Formwork to walls", "derived"],
      ["prelims", "Preliminaries", "manual"],
    ]);
    expect(formwork.from).toEqual(["walls"]);
    expect(prelims.manualKind).toBe("preliminary");
  });
});

describe("which rules give a line kind its code", () => {
  it("knows for sure for rules aimed at items, tags and hand-entered kinds", () => {
    expect(fits({ ruleId: ["slabs", "walls"] }, walls).fit).toBe("yes");
    expect(fits({ tag: "wall" }, walls).fit).toBe("yes");
    expect(fits({ tag: "slab" }, walls).fit).toBe("no");
    expect(fits({ manualKind: "preliminary" }, prelims).fit).toBe("yes");
    expect(fits({ not: { ruleId: "walls" } }, walls).fit).toBe("no");
  });

  it("keeps conditions on line values as conditions, never evaluated", () => {
    expect(fits({ all: [{ ruleId: "walls" }, { where: "is_external = true" }] }, walls)).toEqual({ fit: "maybe", when: { where: "is_external = true" } });
    expect(fits({ any: [{ where: "a" }, { where: "b" }] }, walls)).toEqual({ fit: "maybe", when: { any: [{ where: "a" }, { where: "b" }] } });
    expect(fits({ not: { where: "a" } }, walls)).toEqual({ fit: "maybe", when: { not: { where: "a" } } });
    expect(aimed({ all: [{ ruleId: "walls" }, { where: "x" }] })).toBe(true);
    expect(aimed({ where: "x" })).toBe(false);
  });

  it("orders rules by priority, ties to the earlier one, as the engine does", () => {
    const m = map([
      { id: "concrete", match: { where: 'UNDER(material, "concrete")' }, code: "01", priority: 7 },
      { id: "t-walls-true", match: { all: [{ ruleId: "walls" }, { where: "is_external = true" }] }, code: "D.01", priority: 6 },
      { id: "t-walls", match: { ruleId: "walls" }, code: "D.02", priority: 5 },
      { id: "late", match: { tag: "wall" }, code: "D.09", priority: 5 },
    ]);
    const o = outcomeFor(m, walls);
    expect(o.ifs.map((s) => s.rule.id)).toEqual(["t-walls-true"]);
    expect(o.base?.rule.id).toBe("t-walls");
    // A rule for any line is shown once above the table, not under the row, once a base exists.
    expect(o.general).toEqual([]);
    expect(outcomeFor(m, kinds[1]!)).toEqual({ ifs: [], general: [expect.objectContaining({ index: 0 })] });
  });

  it("resolves a rule-id lookup and follows 'same as its source'", () => {
    const m = map([
      { id: "lookup", match: { tag: ["wall", "formwork"] }, code: { lookup: "rule_id", table: { walls: "D.01" }, default: "Z" } },
      { id: "fw", match: { ruleId: "formwork-walls" }, code: { fromSource: true }, priority: 5 },
    ]);
    expect(outcomeFor(m, walls).base?.code).toBe("D.01");
    expect(outcomeFor(m, formwork).base?.code).toEqual({ fromSource: true });
    expect(sourceCode(m, formwork, kinds)).toBe("D.01");
    expect(coverage(m, kinds)).toEqual({ sure: 2, some: 0, none: 2 });
  });
});

describe("the Codes per line table", () => {
  it("reads plain and split rows, and leaves other rules advanced", () => {
    const m = map([
      { id: "t-walls-true", match: { all: [{ ruleId: "walls" }, { where: "is_external = true" }] }, code: "D.01", priority: 6 },
      { id: "t-walls", match: { ruleId: "walls" }, code: "D.02", priority: 5 },
      { id: "again", match: { ruleId: "walls" }, code: "D.03" },
      { id: "cond", match: { where: "x" }, code: "Z" },
    ]);
    const { rows, used } = readTable(m);
    expect(rows.get("walls")).toEqual({ split: "external", code: "D.02", values: [{ value: "true", code: "D.01" }] });
    expect([...used]).toEqual([0, 1]);
    expect(viaAdvanced(m.rules.filter((_, i) => !used.has(i)), "walls")).toEqual([["again", "D.03"]]);
  });

  it("writes a row as map rules, deeper split values first, and reads it back", () => {
    const m = writeRow(map([{ id: "keep", match: { where: "x" }, code: "Z" }]), "walls", {
      split: "material",
      code: "D",
      values: [
        { value: "concrete", code: "D.1" },
        { value: "concrete.in_situ", code: "D.2" },
        { value: "timber", code: null },
      ],
    });
    expect(m.rules.map((r) => r.id)).toEqual(["t-walls-concrete.in_situ", "t-walls-concrete", "t-walls", "keep"]);
    expect(m.rules[0]).toEqual({ id: "t-walls-concrete.in_situ", match: { all: [{ ruleId: "walls" }, { where: 'UNDER(material, "concrete.in_situ")' }] }, code: "D.2", priority: 6 });
    expect(readTable(m).rows.get("walls")).toEqual({
      split: "material",
      code: "D",
      values: [
        { value: "concrete.in_situ", code: "D.2" },
        { value: "concrete", code: "D.1" },
      ],
    });
    // Writing the row again replaces its rules, never anyone else's.
    expect(writeRow(m, "walls", { split: "none", code: null, values: [] }).rules.map((r) => r.id)).toEqual(["keep"]);
    expect(parseWhere('UNDER(element_type, "wall.party")')).toEqual({ kind: "element_type", value: "wall.party" });
    expect(parseWhere("storey = 1")).toBeNull();
  });

  it("suggests the code whose title shares the most words, more specific codes on ties", () => {
    const codes: Code[] = [
      { code: "D", title: "Walls" },
      { code: "D.01", title: "External walls" },
      { code: "E", title: "Floors and slabs" },
    ];
    expect(suggest("External walls external-walls", codes)).toBe("D.01");
    expect(suggest("Slabs slabs", codes)).toBe("E");
    expect(suggest("Doors", codes)).toBeNull();
  });
});

describe("the code list", () => {
  const codes: Code[] = [
    { code: "B.01", title: "Foundations" },
    { code: "A", title: "Preliminaries" },
    { code: "B", title: "Substructure" },
    { code: "B.01.02", title: "Pads" },
    { code: "X1", title: "Explicit child", parent: "A" },
    { code: "ORPHAN", title: "Lost parent", parent: "NOPE" },
  ];

  it("orders codes as a tree, depth first, without losing any", () => {
    expect(treeOrder(codes, ".").map((r) => `${"  ".repeat(r.depth)}${r.c.code}`)).toEqual(["A", "  X1", "B", "  B.01", "    B.01.02", "ORPHAN"]);
    expect(treeOrder(codes, undefined).map((r) => `${r.depth}${r.c.code}`)).toEqual(["0B.01", "0A", "1X1", "0B", "0B.01.02", "0ORPHAN"]);
    // A parent loop still shows every code.
    expect(treeOrder([{ code: "P", title: "", parent: "Q" }, { code: "Q", title: "", parent: "P" }], undefined)).toHaveLength(2);
  });

  it("orders 10,000 codes quickly (paged tables for big lists)", () => {
    const big: Code[] = [];
    for (let a = 0; a < 10; a++) {
      big.push({ code: `${a}`, title: `Group ${a}` });
      for (let b = 0; b < 30; b++) {
        big.push({ code: `${a}.${b}`, title: `Sub ${b}` });
        for (let c = 0; c < 32; c++) big.push({ code: `${a}.${b}.${c}`, title: `Item ${c}` });
      }
    }
    const t0 = performance.now();
    const rows = treeOrder(big, ".");
    expect(rows).toHaveLength(big.length);
    expect(rows[2]!.c.code).toBe("0.0.0");
    expect(performance.now() - t0).toBeLessThan(500);
    // The table shows one page of them at a time.
    const first = pageOf(rows, 0);
    expect(first).toMatchObject({ current: 0, pages: Math.ceil(big.length / PAGE_SIZE), from: 1 });
    expect(first.rows).toHaveLength(PAGE_SIZE);
    const last = pageOf(rows, 999);
    expect(last.current).toBe(last.pages - 1);
    expect(last.rows.at(-1)).toBe(rows.at(-1));
    expect(pageOf([], 3)).toMatchObject({ rows: [], current: 0, pages: 1 });
  });

  it("adds, renames and imports codes", () => {
    expect(newCode(codes, ".", "B", "New")).toEqual({ code: "B.02", title: "New" });
    expect(newCode(codes, undefined, "A", "New")).toEqual({ code: "A.02", title: "New", parent: "A" });
    expect(newCode([{ code: "A", title: "" }], ".", undefined, "New").code).toBe("B");
    expect(renameCode(codes, 1, "AA").find((c) => c.code === "X1")!.parent).toBe("AA");
    const list: CodeList = { schemaVersion: "1.0", id: "c", name: "C", kind: "company", separator: "-", codes: [{ code: "A", title: "Old", description: "kept" }] };
    const merged = mergeCodes(list, [{ code: "A", title: "New" }, { code: "B", title: "Bee" }], "merge", ".");
    expect(merged.codes).toEqual([{ code: "A", title: "New", description: "kept" }, { code: "B", title: "Bee" }]);
    expect(merged.separator).toBe(".");
    const replaced = mergeCodes(list, [{ code: "B", title: "Bee" }], "replace", null);
    expect(replaced.codes).toEqual([{ code: "B", title: "Bee" }]);
    expect(replaced.separator).toBeUndefined();
  });

  it("knows which rules give each code", () => {
    const m = map([
      { id: "r1", match: { where: "x" }, code: "A" },
      { id: "r2", match: { where: "y" }, code: { lookup: "material", table: { concrete: "A", timber: "B" }, default: "C" } },
    ]);
    expect(codeUsage(m)).toEqual({ A: ["r1", "r2"], B: ["r2"], C: ["r2"] });
  });
});

describe("the sentences (classificationEditor messages)", () => {
  const t = createTranslator({
    locale: "en",
    messages: { classificationEditor: messages },
    namespace: "classificationEditor",
    onError: (e) => {
      throw e;
    },
  });

  it("put the classification and the import in words", () => {
    expect(t("story.coverage", { ruleSet: "As modelled", total: 4, sure: 2, some: 1, none: 1 })).toBe("With the items of As modelled: 2 of 4 kinds of line always get a code, 1 only in some cases, 1 none.");
    expect(t("words.lookup", { field: "material", n: 1, hasDefault: "yes", fallback: "Z" })).toBe("a code looked up by material (1 value, otherwise Z)");
    expect(t("import.apply", { n: 3 })).toBe("Import 3 codes");
    expect(t("rules.prioritySentence", { priority: 7, wins: "yes", hasNote: "no", note: "" })).toBe("Priority 7: wins over the table's rows.");
    expect(t("import.column", { letter: "B", header: "", hasHeader: "no" })).toBe("B · (no header)");
  });

  it("compile every message (ICU plurals, selects and tags)", () => {
    const leaves = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : leaves(v as object, `${prefix}${k}.`)));
    const keys = leaves(messages);
    expect(keys.length).toBeGreaterThan(100);
    for (const key of keys) {
      const text = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages) as string;
      // Values that fit each argument: numbers for plurals, "yes" for selects, functions for tags.
      const values: Record<string, unknown> = {};
      for (const [, name] of text.matchAll(/\{(\w+)[,}]/g)) values[name!] = "x";
      for (const [, name] of text.matchAll(/\{(\w+), select/g)) values[name!] = "yes";
      for (const [, name] of text.matchAll(/\{(\w+), plural/g)) values[name!] = 2;
      for (const [, name] of text.matchAll(/<(\w+)>/g)) values[name!] = (chunks: unknown) => chunks;
      expect(() => t.rich(key as never, values as never), key).not.toThrow();
    }
  });
});

describe("kinds of line", () => {
  it("are plain data the table and the story share", () => {
    const k: LineKind = { id: "x", label: "X", group: "item", tags: [] };
    expect(outcomeFor(map([]), k)).toEqual({ ifs: [], general: [] });
  });
});

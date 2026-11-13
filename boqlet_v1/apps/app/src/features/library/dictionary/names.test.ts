import { describe, expect, it } from "vitest";
import type { Dictionary, NameUse } from "@ifc-boq/types";
import { assignNames, commonPrefix, forgetName, rowOrder, rowsOf, suggestTerm, withoutExact } from "./names";

const use = (u: Partial<NameUse> & Pick<NameUse, "field" | "raw">): NameUse => ({ term: null, method: "none", count: 1, classes: [], worthAsking: false, extracted: {}, ...u });
const dict = (entries: Dictionary["entries"] = []): Dictionary => ({ schemaVersion: "1.0", id: "studio", name: "Studio", version: "1", layer: "company", entries });

describe("rows", () => {
  it("shows a material and its layer uses as one row", () => {
    const rows = rowsOf([
      use({ field: "material", raw: "Beton", count: 4, classes: ["IfcWall"] }),
      use({ field: "layer_material", raw: "Beton", count: 6, classes: ["IfcSlab"], worthAsking: true }),
      use({ field: "type_name", raw: "Basic Wall:Ext", count: 2, term: "wall.external", method: "exact", dictionary: "global-seed" }),
    ]);
    expect(rows).toHaveLength(2);
    const beton = rows.find((r) => r.raw === "Beton")!;
    expect(beton).toMatchObject({ group: "materials", fields: ["material", "layer_material"], count: 6, classes: ["IfcSlab", "IfcWall"], worthAsking: true, term: null });
    expect(rows.find((r) => r.raw === "Basic Wall:Ext")!.group).toBe("types");
  });

  it("puts names not understood first, then the ones worth answering", () => {
    const rows = rowsOf([
      use({ field: "material", raw: "A", term: "x" }),
      use({ field: "material", raw: "B" }),
      use({ field: "material", raw: "C", worthAsking: true }),
    ]).sort(rowOrder);
    expect(rows.map((r) => r.raw)).toEqual(["C", "B", "A"]);
  });
});

describe("suggestions", () => {
  const terms = [
    { id: "concrete", label: "Concrete", category: "material" },
    { id: "concrete.in_situ", label: "In-situ concrete", category: "material" },
    { id: "brick", label: "Brick", category: "material" },
  ];
  it("prefers the more specific term on a tie", () => {
    expect(suggestTerm("Concrete - Cast-in-Place", terms)?.id).toBe("concrete.in_situ");
    expect(suggestTerm("Masonry - Brick", terms)?.id).toBe("brick");
    expect(suggestTerm("Gypsum", terms)).toBeNull();
  });
  it("finds a shared start long enough to mean something", () => {
    expect(commonPrefix(["Wall 200", "wall 250"])).toBe("Wall 2");
    expect(commonPrefix(["Wa", "Wb"])).toBe("");
    expect(commonPrefix(["Only one"])).toBe("");
  });
});

describe("assigning terms", () => {
  const rows = rowsOf([
    use({ field: "material", raw: "Beton" }),
    use({ field: "layer_material", raw: "Beton" }),
    use({ field: "type_name", raw: "Wall 200", classes: ["IfcWall"] }),
    use({ field: "type_name", raw: "Wall 250", classes: ["IfcWallStandardCase"] }),
  ]);
  const beton = rows.find((r) => r.raw === "Beton")!;
  const walls = rows.filter((r) => r.raw.startsWith("Wall"));

  it("adds an exact entry for a material on both material fields", () => {
    const d = assignNames(dict(), [beton], "concrete");
    expect(d.entries).toEqual([{ id: "mat-beton", field: ["material", "layer_material"], match: { exact: "Beton" }, term: "concrete", source: "user" }]);
  });

  it("replaces an earlier exact answer for the same name", () => {
    const before = dict([{ id: "mat-beton", field: ["material", "layer_material"], match: { exact: ["Beton", "Concrete"] }, term: "brick", source: "user" }]);
    const d = assignNames(before, [beton], "concrete");
    expect(d.entries.map((e) => [e.id, e.match, e.term])).toEqual([
      ["mat-beton", { exact: "Concrete" }, "brick"],
      ["mat-beton-2", { exact: "Beton" }, "concrete"],
    ]);
  });

  it("writes one entry for several names, by their start and only on some classes", () => {
    const d = assignNames(dict(), walls, "wall.partition", { prefix: "Wall ", classes: ["IfcWall", "IfcWallStandardCase"] });
    expect(d.entries).toEqual([
      { id: "type-wall", field: "type_name", match: { startsWith: "Wall " }, term: "wall.partition", source: "user", when: 'ifc_class = "IfcWall" OR ifc_class = "IfcWallStandardCase"' },
    ]);
    const exact = assignNames(dict(), walls, "wall.partition");
    expect(exact.entries[0]!.match).toEqual({ exact: ["Wall 200", "Wall 250"] });
  });

  it("removes a name again, dropping entries left empty", () => {
    const d = assignNames(dict(), [beton], "concrete");
    expect(forgetName(d, beton).entries).toEqual([]);
    const other = dict([{ id: "t", field: "type_name", match: { exact: "Beton" }, term: "x", source: "user" }]);
    expect(withoutExact(other, "Beton", ["material", "layer_material"])).toEqual(other.entries);
  });
});

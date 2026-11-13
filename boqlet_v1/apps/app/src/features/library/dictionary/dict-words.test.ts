import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import type { DictionaryEntry, Extractor, Term } from "@ifc-boq/types";
import messages from "../../../../messages/en/dictionaryEditor.json";
import { dictWords, type Translate } from "./dict-words";

const t = createTranslator({ locale: "en", messages: { dictionaryEditor: messages }, namespace: "dictionaryEditor.words" }) as unknown as Translate;
const join = (word: string) => (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} ${word} ${l[l.length - 1]}`);
const words = dictWords(t, join("or"), join("and"), (expr) => `[${expr}]`);
const labels: Record<string, string> = { "concrete.in_situ": "In-situ concrete", concrete: "Concrete" };
const label = (id: string) => labels[id];

describe("dictionary sentences", () => {
  it("says what an entry means", () => {
    const e: DictionaryEntry = { id: "e1", field: ["material", "layer_material"], match: { exact: ["Beton", "C25"] }, term: "concrete.in_situ", source: "user" };
    expect(words.entry(e, label)).toBe("A material or layer material that is exactly “Beton” or “C25” means In-situ concrete (concrete.in_situ).");
  });

  it("adds the condition and notes a meaning no dictionary defines", () => {
    const e: DictionaryEntry = { id: "e2", field: "type_name", match: { startsWith: "CT" }, term: "tile.ceramic", when: 'ifc_class = "IfcCovering"', source: "user" };
    expect(words.entry(e, label)).toBe("A type name that starts with “CT” means tile.ceramic, a meaning no dictionary defines, only when [ifc_class = \"IfcCovering\"].");
  });

  it("words properties, patterns and an empty meaning", () => {
    const e: DictionaryEntry = { id: "e3", field: "props.Pset_WallCommon.Reference", match: { regex: "^Z-?25" }, term: "", source: "user" };
    expect(words.entry(e, label)).toBe("A property Pset_WallCommon.Reference that matches the pattern ^Z-?25 means (no meaning chosen).");
  });

  it("describes a term with its parent and how many names mean it", () => {
    const term: Term = { id: "concrete.in_situ", category: "material", label: "In-situ concrete", broader: "concrete" };
    expect(words.termSentence(term, label, 1)).toBe("In-situ concrete is a material, a kind of Concrete (concrete). 1 name in this dictionary means it.");
    expect(words.termSentence({ ...term, broader: undefined, category: "element_type" }, label, 3)).toBe("In-situ concrete is a kind of element. 3 names in this dictionary mean it.");
  });

  it("describes a value reader", () => {
    const x: Extractor = { id: "x1", field: "type_name", regex: "(?<t>\\d+)\\s?mm", outputs: { t: { target: "thickness", unit: "mm" }, c: { target: "strength_class" } } };
    expect(words.extractor(x)).toBe(
      "From the type name, text matching (?<t>\\d+)\\s?mm gives the thickness (written in mm) from the part “t” and strength class from the part “c”. A value the model already has is kept.",
    );
    expect(words.extractor({ ...x, outputs: { t: { target: "thickness" } }, override: true, when: "is_external" })).toBe(
      "From the type name, text matching (?<t>\\d+)\\s?mm gives the thickness from the part “t”, only when [is_external]. It overwrites values the model already has.",
    );
  });

  it("falls back to the raw key for words it does not know", () => {
    expect(words.field("space_name")).toBe("room name");
    expect(words.field("some_field")).toBe("some field");
    expect(words.category("product")).toBe("product (brick, board, window unit…)");
    expect(words.categoryShort("product")).toBe("product");
    expect(words.layer("company")).toBe("company");
  });
});

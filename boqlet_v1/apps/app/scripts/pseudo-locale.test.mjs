import { describe, expect, it } from "vitest";
import { pseudo } from "./pseudo-locale.mjs";

describe("pseudo-locale en-XA", () => {
  it("accents text, wraps it and makes it longer", () => {
    const out = pseudo("Save version");
    expect(out.startsWith("[Šáṽé ṽéŕšíóñ")).toBe(true);
    expect(out.endsWith("]")).toBe(true);
    expect(out.length).toBeGreaterThan("Save version".length * 1.2);
  });
  it("keeps ICU arguments, plural keywords and tags", () => {
    const out = pseudo("{count, plural, one {# line} other {# lines}} in <b>{name}</b>");
    expect(out).toContain("{count, plural, one {# ļíñé} other {# ļíñéš}}");
    expect(out).toContain("<b>{name}</b>");
  });
});

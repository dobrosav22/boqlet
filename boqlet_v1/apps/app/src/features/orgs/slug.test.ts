import { describe, expect, it } from "vitest";
import { SLUG_PATTERN, suggestSlug } from "./slug";

describe("suggestSlug", () => {
  it("makes a valid address from any name", () => {
    expect(suggestSlug("Studio Demo")).toBe("studio-demo");
    expect(suggestSlug("  Arhitekti Đorđević & Partneri d.o.o. ")).toBe("arhitekti-djordjevic-partneri-d-o-o");
    expect(suggestSlug("Bauplanung Müller GmbH")).toBe("bauplanung-muller-gmbh");
    expect(suggestSlug("Straße & Søn")).toBe("strasse-son");
    expect(suggestSlug("AB")).toBe("ab0");
    for (const name of ["Studio Demo", "AB", "x".repeat(80), "Ñandú Arquitectos"]) expect(suggestSlug(name)).toMatch(SLUG_PATTERN);
  });
});

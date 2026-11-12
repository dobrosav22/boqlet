import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("lets a later size from the type scale replace an earlier one", () => {
    expect(cn("display text-[22px]", "text-display")).toBe("display text-display");
    expect(cn("text-ui", "text-title")).toBe("text-title");
  });
  it("keeps a colour next to a size", () => {
    expect(cn("text-ui text-muted-foreground")).toBe("text-ui text-muted-foreground");
  });
});

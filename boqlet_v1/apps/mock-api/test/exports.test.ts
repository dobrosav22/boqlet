import { describe, expect, it } from "vitest";
import type { BoqResult } from "@ifc-boq/types";
import { exportedResult } from "../src/engine/fakes/export-xlsx.js";
import { exportFileName } from "../src/handlers/exports.js";

/** The "BoQ export" fake's input (FE-017, until EN-006) and the export's file name (F12). */

const line = (key: string, extra: Record<string, unknown> = {}) => ({ key, description: key, unit: "m2", quantity: 10, notes: [] as string[], ...extra });

describe("exportedResult", () => {
  it("leaves excluded lines out and writes each edit, the engine's value and the reason in the notes", () => {
    const result = {
      lines: [
        line("a"),
        line("b", { excluded: true, overridden: { fields: ["excluded"], reason: "Out of scope" } }),
        line("c", { quantity: 12, notes: ["n"], overridden: { fields: ["quantity", "description"], engineQuantity: 10, quantity: 12, engineDescription: "Wall", reason: "Site" } }),
      ],
    } as unknown as BoqResult;
    const out = exportedResult(result);
    expect(out.lines.map((l) => l.key)).toEqual(["a", "c"]);
    expect(out.lines[1]!.notes).toEqual(["n", "Edited: quantity edited: 12 instead of 10; description edited (measured as: Wall); reason: Site"]);
    expect(result.lines).toHaveLength(3);
  });
});

describe("exportFileName", () => {
  it("is {project}_{boq}_Rev{label}_{date}.xlsx, sanitised", () => {
    expect(exportFileName("Duplex / Phase 1", "Tender BoQ", "A", "2026-11-13T10:00:00Z")).toBe("Duplex-Phase-1_Tender-BoQ_RevA_2026-11-13.xlsx");
  });
});

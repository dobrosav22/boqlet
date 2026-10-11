/**
 * Regenerates everything the Python engine derives from these types:
 *   packages/types/schema/*.schema.json   JSON Schemas (engine validates presets and requests with them)
 *   engine/ifc_boq/data/families.json     IFC class -> measurement family table
 * Run after changing any type:  npm run codegen
 */
import { createGenerator } from "ts-json-schema-generator";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILY_INFO, IFC_FAMILIES } from "../src/families";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");
const root = resolve(pkg, "../..");

const targets: [file: string, type: string, out: string][] = [
  ["rules.ts", "OurRuleType", "rule-set"],
  ["parsed.ts", "ParsedModel", "parsed-model"],
  ["dictionary.ts", "Dictionary", "dictionary"],
  ["dictionary.ts", "ResolutionSettings", "resolution-settings"],
  ["classification.ts", "CodeList", "codelist"],
  ["classification.ts", "ClassificationMap", "classification-map"],
  ["engine.ts", "BoqResult", "boq-result"],
  ["engine.ts", "Decision", "decision"],
  ["api.ts", "RunRequest", "run-request"],
];

mkdirSync(resolve(pkg, "schema"), { recursive: true });
for (const [file, type, out] of targets) {
  const schema = createGenerator({
    path: resolve(pkg, "src", file),
    tsconfig: resolve(pkg, "tsconfig.json"),
    type,
    skipTypeCheck: true,
  }).createSchema(type);
  writeFileSync(resolve(pkg, "schema", `${out}.schema.json`), JSON.stringify(schema, null, 2) + "\n");
  console.log(`schema  ${out}.schema.json  (${type})`);
}

const famOut = resolve(root, "engine/ifc_boq/data/families.json");
writeFileSync(famOut, JSON.stringify({ IFC_FAMILIES, FAMILY_INFO }, null, 2) + "\n");
console.log("data    engine/ifc_boq/data/families.json");

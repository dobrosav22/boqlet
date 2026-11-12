import path from "node:path";
import { fileURLToPath } from "node:url";

/** Paths the mock reads and writes. `MOCK_DATA_DIR` moves its state (tests use a temp folder). */
export const MOCK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRODUCT_ROOT = path.resolve(MOCK_ROOT, "..", "..");
export const CONTRACT_PATH = path.join(PRODUCT_ROOT, "packages", "api", "openapi.yaml");
export const PRESETS_DIR = path.join(PRODUCT_ROOT, "presets");
export const FIXTURES_DIR = path.join(PRODUCT_ROOT, "fixtures");

export function dataDir(): string {
  return process.env.MOCK_DATA_DIR ? path.resolve(process.env.MOCK_DATA_DIR) : path.join(MOCK_ROOT, ".data");
}

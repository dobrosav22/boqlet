/**
 * `npm run mock:seed` seeds when there is no data yet; `npm run mock:reset` wipes `.data/` and
 * reseeds. The server seeds on its own when it starts without data.
 */
import { rmSync } from "node:fs";
import { buildSeed } from "./seed.js";
import { dataDir } from "./paths.js";
import { flush, loadStore, replaceStore } from "./store.js";

if (process.argv.includes("--reset")) rmSync(dataDir(), { recursive: true, force: true });
if (!loadStore()) {
  replaceStore(buildSeed());
  flush();
  console.log(`[mock] seeded ${dataDir()}`);
} else {
  console.log(`[mock] ${dataDir()} already has data (use mock:reset to start over)`);
}

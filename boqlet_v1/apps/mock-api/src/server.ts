import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { engine } from "./engine/engine.js";
import { flush } from "./store.js";

const port = Number(process.env.MOCK_PORT ?? 4010);
const app = await createApp({ reseed: process.argv.includes("--reseed") });

serve({ fetch: app.fetch, port }, () => {
  console.log(`[mock] boqlet mock API on http://localhost:${port}/api/v1 (dev: /_dev/users)`);
  engine()
    .health()
    .then((h) => console.log(`[mock] engine (${engine().name}) ok, version ${h.version}`))
    .catch((e) => console.log(`[mock] engine (${engine().name}) not reachable yet: ${(e as Error).message}`));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    flush();
    process.exit(0);
  });
}

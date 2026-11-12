import { createReadStream, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The engine (Python, engine/ifc_boq/api.py) runs on 8787; the dev server proxies /api to it.
const engine = `http://127.0.0.1:${process.env.IFC_BOQ_ENGINE_PORT ?? "8787"}`;

/**
 * The public NIBS Duplex sample, served at /samples/ so the guide and the empty BoQ page can offer it
 * (the hosted demo has no repository to open). Read from fixtures/, not copied into the repo twice.
 */
const SAMPLE = "samples/Ifc2x3_Duplex_Architecture.ifc";
const SAMPLE_SRC = fileURLToPath(new URL("../../fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc", import.meta.url));
function sampleModel(): Plugin {
  return {
    name: "ifc-boq-sample-model",
    configureServer(server) {
      server.middlewares.use(`/${SAMPLE}`, (_req, res) => {
        res.setHeader("Content-Type", "application/octet-stream");
        createReadStream(SAMPLE_SRC).pipe(res);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: SAMPLE, source: readFileSync(SAMPLE_SRC) });
    },
  };
}

export default defineConfig({
  plugins: [react(), sampleModel()],
  server: { port: 5173, proxy: { "/api": { target: engine, changeOrigin: true } } },
  preview: { port: 4173, proxy: { "/api": { target: engine, changeOrigin: true } } },
});

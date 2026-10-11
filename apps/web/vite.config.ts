import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The engine (Python, engine/ifc_boq/api.py) runs on 8787; the dev server proxies /api to it.
const engine = `http://127.0.0.1:${process.env.IFC_BOQ_ENGINE_PORT ?? "8787"}`;

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: engine, changeOrigin: true } } },
  preview: { port: 4173, proxy: { "/api": { target: engine, changeOrigin: true } } },
});

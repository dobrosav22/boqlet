import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// On Windows a shell can hand over the cwd with a lower-case drive letter ("c:\..."), and Vitest
// then loads `vitest` twice ("Cannot read properties of undefined (reading 'config')").
const root = __dirname.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

export default defineConfig({
  root,
  plugins: [react()],
  resolve: { alias: { "@": path.join(root, "src") } },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    environment: "node",
    testTimeout: 30_000,
  },
});

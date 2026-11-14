import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// On Windows a shell can hand over the cwd with a lower-case drive letter ("c:\..."), and Vitest
// then loads `vitest` twice ("Cannot read properties of undefined (reading 'config')").
const root = __dirname.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.join(root, "src") },
      // The workspace root holds the PoC's React 18 (apps/web): component tests render with the app's React 19.
      { find: /^react$/, replacement: path.join(root, "node_modules", "react") },
      { find: /^react\/(.*)$/, replacement: path.join(root, "node_modules", "react", "$1") },
      { find: /^react-dom$/, replacement: path.join(root, "node_modules", "react-dom") },
      { find: /^react-dom\/(.*)$/, replacement: path.join(root, "node_modules", "react-dom", "$1") },
    ],
  },
  test: {
    // Hoisted to the workspace root: transformed here, so their React imports get the aliases above.
    server: { deps: { inline: ["next-intl", "use-intl"] } },
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    environment: "node",
    testTimeout: 30_000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname.replace(/^[a-z]:/, (drive) => drive.toUpperCase()),
  test: { include: ["test/**/*.test.ts"], testTimeout: 120_000, hookTimeout: 120_000, fileParallelism: false },
});

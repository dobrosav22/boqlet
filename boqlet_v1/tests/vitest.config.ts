import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["contract/**/*.test.ts", "scenarios/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One backend, shared state: files run one after another.
    fileParallelism: false,
  },
});

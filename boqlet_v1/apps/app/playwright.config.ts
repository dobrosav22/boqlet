import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the app (08-delivery/testing.md) against the mock API. Playwright starts
 * the mock (reseeded, in its own data folder) and the app unless they are already running
 * (`npm run dev:app`). Flows that need the engine start it too once they exist (TS-001).
 */
const port = Number(process.env.APP_PORT ?? 3000);
export const MOCK_URL = process.env.MOCK_URL ?? "http://localhost:4010";
const productRoot = path.resolve(__dirname, "..", "..");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // One dev server compiles routes on demand; more than two workers make first visits time out.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // The dev server compiles a route on its first visit; that can take several seconds.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run start -w @ifc-boq/mock-api -- --reseed",
      cwd: productRoot,
      url: `${MOCK_URL}/`,
      env: { MOCK_DATA_DIR: path.join(productRoot, "apps", "mock-api", ".data-e2e") },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});

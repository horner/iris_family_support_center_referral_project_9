import { defineConfig, devices } from "@playwright/test";

// The phone journey is the one that has to work: supervisors triage between
// home visits. Desktop projects only exist to catch layout regressions.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "on-first-retry" },
  projects: [
    { name: "iPhone 13", use: { ...devices["iPhone 13"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

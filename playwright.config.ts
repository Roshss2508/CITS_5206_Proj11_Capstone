import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chrome",
      use: {
        browserName: "chromium",
        channel: "chrome",
      },
    },
    {
      name: "edge",
      use: {
        browserName: "chromium",
        channel: "msedge",
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

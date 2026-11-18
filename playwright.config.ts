import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser-tests", testMatch: "**/*.e2e.mjs",
  workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4189", launchOptions: {
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  } },
  webServer: { command: "npm run preview:test", url: "http://127.0.0.1:4189", reuseExistingServer: false },
});

import { defineConfig } from "@playwright/test";
const baseURL = "http://127.0.0.1:4189" + (process.env.VITE_BASE_PATH || "/");
export default defineConfig({
  testDir: "./browser-tests", testMatch: "**/*.e2e.mjs",
  workers: 1, timeout: 60000,
  use: { baseURL, launchOptions: {
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  } },
  webServer: { command: "npm run preview:test", url: baseURL, reuseExistingServer: false },
});

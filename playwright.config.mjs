import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
const executablePath = process.env.CHROMIUM_PATH;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 7000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: executablePath
      ? {
          executablePath,
          args: chromium.args.filter((arg) => arg !== "--single-process"),
        }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 15000,
  },
});

import { brotliDecompressSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
if (!existsSync("/tmp/terra-browser-libs/lib/libnspr4.so")) {
  writeFileSync(
    "/tmp/terra-browser-libs.tar",
    brotliDecompressSync(
      readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
    ),
  );
  mkdirSync("/tmp/terra-browser-libs", { recursive: true });
  execFileSync("tar", [
    "-xf",
    "/tmp/terra-browser-libs.tar",
    "-C",
    "/tmp/terra-browser-libs",
  ]);
}
process.env.LD_LIBRARY_PATH =
  "/tmp/terra-browser-libs/lib:" + (process.env.LD_LIBRARY_PATH || "");
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  timeout: 40000,
  reporter: "list",
  use: {
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: await chromium.executablePath(),
      args: chromium.args.filter(
        (a) => a !== "--single-process" && a !== "--disable-web-security",
      ),
    },
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});

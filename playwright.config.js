import { brotliDecompressSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { defineConfig } from '@playwright/test';
import chromium from '@sparticuz/chromium';

// The bundled headless browser works without a system Chromium installation on Linux.
const libs = '.local/browser-libs';
if (!existsSync(`${libs}/lib/libnspr4.so`)) {
  mkdirSync(libs, { recursive: true });
  writeFileSync('.local/browser-libs.tar', brotliDecompressSync(readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
  execFileSync('tar', ['-xf', '.local/browser-libs.tar', '-C', libs]);
}
process.env.LD_LIBRARY_PATH = `${process.cwd()}/${libs}/lib:${process.env.LD_LIBRARY_PATH || ''}`;
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.js',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    launchOptions: {
      executablePath: await chromium.executablePath(),
      args: chromium.args.filter((arg) => arg !== '--single-process' && arg !== '--disable-web-security'),
    },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30000,
  },
});

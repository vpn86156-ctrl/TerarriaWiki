// Optional Linux sandbox runner. Normal development can use Playwright's own Chromium.
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import chromium from "@sparticuz/chromium";
const packageBuild = dirname(
  new URL(import.meta.resolve("@sparticuz/chromium")).pathname,
);
const { inflate } = await import(
  new URL("./lambdafs.js", import.meta.resolve("@sparticuz/chromium"))
);
const libraries = await inflate(resolve(packageBuild, "../bin/al2023.tar.br"));
const executablePath = await chromium.executablePath();
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      CHROMIUM_PATH: executablePath,
      LD_LIBRARY_PATH: `${libraries}/lib:${process.env.LD_LIBRARY_PATH || ""}`,
    },
  },
);
child.on("exit", (code) => (process.exitCode = code ?? 1));

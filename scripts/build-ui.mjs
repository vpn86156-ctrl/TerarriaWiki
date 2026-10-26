// Internal APK assets, not a website/PWA distribution.
import { build } from "vite";
import { readFile, writeFile, rm, mkdir, readdir, cp } from "node:fs/promises";
import { join } from "node:path";
const root = process.cwd(),
  stage = join(root, "build/ui-bundle"),
  dest = join(root, "build/ui");
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await build({
  define: {
    __TERRA_DESIGN_PREVIEW__: JSON.stringify(
      process.env.TERRA_DESIGN_PREVIEW === "1",
    ),
  },
  publicDir: "public",
  build: {
    copyPublicDir: false,
    cssCodeSplit: false,
    outDir: stage,
    emptyOutDir: true,
    target: "chrome100",
    rollupOptions: {
      input: "ui/index.html",
      output: { format: "iife", inlineDynamicImports: true },
    },
  },
});
const assets = await readdir(join(stage, "assets")),
  js = assets.find((f) => f.endsWith(".js")),
  css = assets.find((f) => f.endsWith(".css"));
const script = (await readFile(join(stage, "assets", js), "utf8")).replace(
  /<\/script/gi,
  "<\\/script",
);
const style = (await readFile(join(stage, "assets", css), "utf8")).replaceAll(
  "../fonts/",
  "./fonts/",
);
let html = await readFile(join(stage, "ui/index.html"), "utf8");
html = html
  .replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/g, "")
  .replace(
    /<link\b[^>]*rel="stylesheet"[^>]*>/g,
    () => `<style>${style}</style>`,
  )
  .replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, "");
html = html.replace("</body>", () => `<script>${script}</script></body>`);
await writeFile(join(dest, "index.html"), html);
for (const dir of ["images", "fonts", "icons"])
  await cp(join(root, "public", dir), join(dest, dir), { recursive: true });
await cp(join(root, "ATTRIBUTION.md"), join(dest, "ATTRIBUTION.md"));
await rm(stage, { recursive: true, force: true });
console.log("Internal Android UI assets ready: build/ui");

import http from "node:http";
import { attachRooms } from "../server/rooms.mjs";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
const server = http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://local").pathname,
      );
      if (pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "last-torch-coop" }));
        return;
      }
      if (
        ![
          "/",
          "/index.html",
          "/styles.css",
          "/favicon.svg",
          "/manifest.webmanifest",
          "/sw.js",
        ].includes(pathname) &&
        !/^\/(src|icons)\/[a-zA-Z0-9_.-]+$/.test(pathname)
      ) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      if (pathname.split("/").some((part) => part.startsWith("."))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      let path = resolve(root, "." + pathname);
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Последний факел: http://0.0.0.0:${port}`),
  );

attachRooms(server);

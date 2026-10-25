const CACHE = "last-torch-shell-v2.0.0-final2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./src/app.js",
  "./src/engine.js",
  "./src/render.js",
  "./src/profile.js",
  "./src/features.js",
  "./src/coop.js",
  "./src/coop-config.js",
];
const absolute = (path) => new URL(path, self.registration.scope).href;
const allowed = new Set(ASSETS.map(absolute));
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          ASSETS.map(
            (path) => new Request(absolute(path), { cache: "reload" }),
          ),
        ),
      ),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (
          (key.startsWith("last-torch-shell-") && key !== CACHE) ||
          key.startsWith("terraria-guide-v1-")
        )
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.open(CACHE);
        return (await cached.match(absolute("./index.html"))) || fetch(request);
      })(),
    );
    return;
  }
  url.search = "";
  if (!allowed.has(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.href)) || fetch(request);
    })(),
  );
});

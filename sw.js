// Retirement-only worker for installations of the former wiki. New visitors do not register it.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("terraria-guide-v1-"))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      await self.registration.unregister();
      await Promise.all(
        clients
          .filter((client) => client.url.startsWith(self.registration.scope))
          .map((client) => client.navigate(client.url).catch(() => {})),
      );
    })(),
  ),
);

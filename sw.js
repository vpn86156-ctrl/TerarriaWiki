// Retire the former site's offline worker. Keep this URL available so existing
// installations can update, stop serving old pages and return to the blank site.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('terraria-guide-v1-'))
      .map(name => caches.delete(name)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({type: 'window'});
    await self.registration.unregister();
    await Promise.all(windows
      .filter(client => client.url.startsWith(self.registration.scope))
      .map(client => client.navigate(client.url).catch(() => {})));
  })());
});

// No fetch handler, precache or access to browser progress/localStorage.

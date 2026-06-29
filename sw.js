const CACHE_NAME = 'sportslive-v9';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // APIs → toujours réseau
  if (url.hostname.includes('espn.com') ||
      url.hostname.includes('githubusercontent.com') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('abacus.jasoncameron.dev')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }
  // Tout le reste → toujours réseau (pas de cache)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

/* ═══════════════════════════════════════════
   SportsLive — Service Worker v2.0
   Cache agressif pour chargement instantané
═══════════════════════════════════════════ */

const CACHE_NAME = 'sportslive-v2';
const APP_SHELL = [
  '/CDM_2026/index.html',
  '/CDM_2026/manifest.json',
];

// INSTALL — met en cache l'app shell immédiatement
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — supprime les vieux caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH — Cache First pour l'app, Network First pour les APIs
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs externes → toujours réseau
  if (url.hostname.includes('espn.com') ||
      url.hostname.includes('githubusercontent.com') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('abacus.jasoncameron.dev')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response('{}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // App shell → Cache First (instantané)
  event.respondWith(
    caches.match(event.request).then(cached => {
      // Retourne le cache immédiatement
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// MESSAGE — reçoit les mises à jour de scores
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

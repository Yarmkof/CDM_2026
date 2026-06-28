/* ═══════════════════════════════════════════
   SportsLive — Service Worker v1.0
   Cache offline + notifications push
═══════════════════════════════════════════ */

const CACHE_NAME = 'sportslive-v1';
const OFFLINE_URL = '/sportslive-pwa/index.html';

// Ressources à mettre en cache au premier chargement
const PRECACHE_URLS = [
  '/sportslive-pwa/index.html',
  '/sportslive-pwa/manifest.json',
  '/sportslive-pwa/icons/icon-192.png',
  '/sportslive-pwa/icons/icon-512.png',
];

/* ── INSTALLATION ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Si certains fichiers manquent, on continue quand même
        return cache.add(OFFLINE_URL);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATION ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* ── FETCH — Stratégie Network First avec fallback cache ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // APIs externes → toujours réseau, jamais de cache
  if (
    url.hostname.includes('githubusercontent.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('worldcup26.ir') ||
    url.hostname.includes('espn.com') ||
    url.hostname.includes('api.')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Si l'API échoue, on retourne une réponse vide JSON
        return new Response('{"matches":[]}', {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // App shell → Cache First avec fallback réseau
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(response => {
        // On met en cache uniquement les réponses valides
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback page offline
        return caches.match(OFFLINE_URL);
      });
    })
  );
});

/* ── NOTIFICATIONS PUSH ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Nouveau score disponible !',
    icon: '/sportslive-pwa/icons/icon-192.png',
    badge: '/sportslive-pwa/icons/icon-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'sportslive-score',
    renotify: true,
    data: { url: data.url || '/sportslive-pwa/index.html' },
    actions: [
      { action: 'open', title: 'Voir le score' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || '⚽ SportsLive', options
    )
  );
});

/* ── CLIC SUR NOTIFICATION ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || '/sportslive-pwa/index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

/* ── SYNC EN ARRIÈRE-PLAN ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-scores') {
    event.waitUntil(syncScores());
  }
});

async function syncScores() {
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/gh/openfootball/worldcup.json@master/2026/worldcup.json'
    );
    if (res.ok) {
      const data = await res.json();
      // Envoie les données à toutes les fenêtres ouvertes
      const allClients = await clients.matchAll();
      allClients.forEach(client => {
        client.postMessage({ type: 'SCORES_UPDATE', data });
      });
    }
  } catch (e) {
    // Sync échouée, sera retenté automatiquement
  }
}

/**
 * Service Worker for INVICT Security Solutions S.A.
 * Enables PWA desktop installation, robust offline resilience with Stale-While-Revalidate strategy
 * across static assets and APIs, and background push alerts for office workstations.
 */

const CACHE_NAME = 'invict-cache-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192-v2.png',
  '/icons/icon-512-v2.png',
  '/brand/invict-emblem-white.png',
  '/brand/invict-emblem-color.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Failed to precache some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-only for all API/Supabase traffic; Network-first for HTML & app bundles
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore browser extensions and unsupported protocols
  if (url.protocol.startsWith('chrome-extension') || url.protocol.startsWith('moz-extension')) {
    return;
  }

  // NEVER cache cross-origin requests (e.g., Supabase REST/Realtime/Auth) or API endpoints
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/realtime/') ||
    url.searchParams.has('__version_check')
  ) {
    return;
  }

  // Network-first para páginas HTML: así cada equipo recibe la última versión publicada
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Stale-While-Revalidate: Return cached version immediately while updating in the background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch from network to revalidate and update cache in the background
        const networkFetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // If network fails and we didn't have cachedResponse
            if (!cachedResponse) {
              if (event.request.headers.get('accept')?.includes('text/html')) {
                return cache.match('/index.html') || cache.match('/');
              }
              if (url.pathname.startsWith('/api/')) {
                return new Response(
                  JSON.stringify({ offline: true, error: 'Sin conexión de red', timestamp: new Date().toISOString() }),
                  { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
              }
              return new Response('Sin conexión a la red de oficina', { status: 503, statusText: 'Offline' });
            }
            return cachedResponse;
          });

        // Serve cached immediately if present, otherwise await the network response
        return cachedResponse || networkFetchPromise;
      });
    })
  );
});

// Background Push Notification Event
self.addEventListener('push', (event) => {
  let data = { title: 'INVICT Security', body: 'Nueva notificación operativa', tag: 'invict-alert' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192-v2.png',
    badge: '/icons/icon-192-v2.png',
    tag: data.tag || 'invict-notification',
    vibrate: [200, 100, 200],
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

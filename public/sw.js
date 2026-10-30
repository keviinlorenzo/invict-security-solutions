/**
 * Service Worker for INVICT Security Solutions S.A.
 * Enables PWA desktop installation, robust offline resilience with Stale-While-Revalidate strategy
 * across static assets and APIs, and background push alerts for office workstations.
 */

const CACHE_NAME = 'invict-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/invict-logo-full.svg',
  '/assets/invict-emblem.svg'
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

// Stale-While-Revalidate Strategy for all static assets and APIs
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore browser extensions and unsupported protocols
  if (url.protocol.startsWith('chrome-extension') || url.protocol.startsWith('moz-extension')) {
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
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
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

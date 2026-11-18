/**
 * Service Worker for INVICT Security Solutions S.A.
 * Enables PWA desktop installation, robust offline resilience with Stale-While-Revalidate strategy
 * across static assets and APIs, and background push alerts for office workstations.
 */

const CACHE_NAME = 'invict-cache-v21';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192-v2.png',
  '/icons/icon-512-v2.png',
  '/brand/invict-emblem-white.png',
  '/brand/invict-emblem-color.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Failed to precache some assets:', err);
      });
    })
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

// Network-only for all API/Supabase traffic; Network-first for HTML & app bundles so no client ever runs stale code
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.protocol.startsWith('chrome-extension') || url.protocol.startsWith('moz-extension')) {
    return;
  }

  // NEVER intercept or cache cross-origin requests (Supabase REST/Realtime/Auth) or API endpoints
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

  // Network-first for all same-origin requests (HTML, JS, CSS, assets)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html').then((r) => r || caches.match('/'));
          }
          return new Response('Sin conexión a la red', { status: 503, statusText: 'Offline' });
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

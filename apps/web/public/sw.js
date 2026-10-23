/* تماس مارکت | Service Worker Auto-Cleanup & Cache Bypass */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('tamas-') || key.startsWith('tamasmarket-')).map((key) => caches.delete(key))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Directly bypass service worker to ensure browsers fetch fresh network content
  event.respondWith(fetch(event.request));
});
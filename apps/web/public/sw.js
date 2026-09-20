/* تماس مارکت | Service Worker v1.0.0 */
const VERSION = '1.0.0';
const PRECACHE = 'tamas-' + VERSION;
const RUNTIME = 'tamas-runtime-' + VERSION;

/* فایل‌های پوسته اپلیکیشن که همیشه آفلاین نگه داشته می‌شوند */
const SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/logo.svg',
  '/admin-icon-fix.css',
  '/icons/pwa-192.png',
  '/icons/pwa-512.png',
  '/icons/pwa-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* درخواست‌های API همیشه از شبکه خوانده می‌شوند تا داده همیشه تازه باشد */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  /* باز کردن صفحه: اول شبکه، در صورت آفلاین بودن پوسته کش‌شده */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches
            .open(PRECACHE)
            .then((cache) => cache.put('/index.html', copy))
            .catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match('/index.html')
            .then((shell) => shell || caches.match('/offline.html')),
        ),
    );
    return;
  }

  /* فایل‌های استاتیک: کش اول، و در پس‌زمینه بروزرسانی می‌شوند */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches
                .open(RUNTIME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches
            .open(RUNTIME)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      });
    }),
  );
});
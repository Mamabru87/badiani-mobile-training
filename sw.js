/* Badiani Training Service Worker
 * - Cache-first for static assets (CSS, JS, fonts, images)
 * - Network-first for HTML (so updates land fast)
 * - Skip cache for video_embargo (large) and external URLs
 */
const VERSION = 'badiani-v2-20260610-17';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE = [
  './',
  './index.html',
  './caffe.html',
  './gelato-lab.html',
  './pastries.html',
  './sweet-treats.html',
  './festive.html',
  './operations.html',
  './story-orbit.html',
  './quiz-solution.html',
  './styles/site.css',
  './scripts/config.js',
  './scripts/site.js',
  './scripts/i18n.js',
  './scripts/i18n-manager.js',
  './scripts/deep-link.js',
  './scripts/avatar-lab.js',
  './scripts/gelato-effects.js',
  './scripts/berny-ui.js',
  './scripts/vendor/lottie-player.js',
  './manifest.webmanifest',
  './assets/brand/logo-badiani.webp',
  './assets/brand/logo-b-blue.webp',
  './assets/brand/logo-b-blue-180.png',
  './assets/brand/logo-b-blue-192.png',
  './assets/brand/logo-b-blue-512.png',
  './assets/brand/favicon-64.png',
  './assets/avatars/berni-avatar.webp',
  './fonts/stylesheet.css',
  './fonts/SuperGroteskA-Rg.woff2',
  './fonts/SuperGroteskB-CdMed.woff2',
  './fonts/SuperGroteskC-MedLF.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch((err) => {
        console.warn('[SW] precache partial:', err);
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

const isHTML = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

const isCacheable = (url) => {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.includes('/video_embargo/')) return false;
  if (url.pathname.endsWith('.mp4')) return false;
  if (url.pathname.endsWith('.psb') || url.pathname.endsWith('.psd')) return false;
  return true;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!isCacheable(url)) return;

  if (isHTML(req)) {
    // Network-first for HTML
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res.ok || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

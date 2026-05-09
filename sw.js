/* Badiani Training Service Worker
 * - Cache-first for static assets (CSS, JS, fonts, images)
 * - Network-first for HTML (so updates land fast)
 * - Skip cache for video_embargo (large) and external URLs
 */
const VERSION = 'badiani-v1-20260509';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE = [
  './',
  './index.html',
  './styles/site.css',
  './scripts/config.js',
  './scripts/site.js',
  './scripts/i18n.js',
  './scripts/berny-knowledge.js',
  './scripts/berny-super-knowledge.js',
  './scripts/berny-brain-api.js',
  './scripts/berny-ui.js',
  './scripts/berny-widget-controller.js',
  './scripts/search-catalog-seed.js',
  './scripts/avatar-lab.js',
  './scripts/gelato-effects.js',
  './scripts/vendor/lottie-player.js',
  './manifest.webmanifest',
  './assets/brand/logo-b-blue.webp',
  './assets/brand/logo-badiani.jpg',
  './fonts/stylesheet.css',
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

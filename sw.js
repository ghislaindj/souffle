// Souffle — service worker cache-first.
// Incrémenter CACHE à chaque release : l'activation purge les anciens caches.
const CACHE = 'souffle-v2';

const FONTS = [
  'bricolage-600', 'bricolage-700',
  'plex-sans-400', 'plex-sans-400-italic', 'plex-sans-500', 'plex-sans-600',
  'plex-mono-400', 'plex-mono-500', 'plex-mono-600', 'plex-mono-700',
].flatMap((f) => [`fonts/${f}.woff2`, `fonts/${f}-ext.woff2`]);

const ASSETS = [
  './',
  'index.html',
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'seed-songs.json',
  'fonts/fonts.css',
  ...FONTS,
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'assets/nosleep.mp4',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('souffle-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navigation : toujours la coquille en cache (l'app route via le hash).
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html').then((res) => res || fetch(req)));
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.status === 200 && !req.headers.has('range')) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});

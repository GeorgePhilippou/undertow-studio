// Offline support. Pages and code are fetched fresh when online and fall back
// to the last copy offline; piano samples and fonts are kept once loaded.

const CACHE = 'undertow-v1';
const CORE = [
  './', 'index.html', 'mac.css', 'icon.svg', 'manifest.webmanifest',
  'src/main.js', 'src/songs.js', 'src/beats.js', 'src/player.js', 'src/render.js', 'src/storage.js',
  'src/audio/engine.js', 'src/audio/piano.js', 'src/audio/synths.js', 'src/audio/drums.js',
  'src/play/index.js', 'src/play/worlds.js', 'src/play/art.js', 'src/play/pieces.js',
  'src/ui/mac.js', 'src/ui/icons.js', 'src/ui/keyboard.js', 'src/ui/roll.js', 'src/ui/balloons.js',
  'assets/fonts/chikarego2.woff2', 'assets/fonts/geneva-9.ttf',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true })));
});

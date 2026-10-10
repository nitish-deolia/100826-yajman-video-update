const CACHE_NAME = 'yajman-pwa-v4';
const APP_BASE_URL = new URL('./', self.registration.scope);
const appFile = (path) => new URL(path, APP_BASE_URL).href;
const APP_SHELL = [
  '',
  'index.html',
  'manifest.webmanifest',
  'logo.png',
  'footer.PNG',
  'remaining_fixed_video.mp4',
  'full_audio.mp3',
  'pwa-icon-180.png',
  'pwa-icon-192.png',
  'pwa-icon-512.png',
].map(appFile);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);

    const html = await (await cache.match(appFile('index.html'))).text();
    const appFiles = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], APP_BASE_URL))
      .filter((url) => url.origin === self.location.origin && /\.(?:m?js|css)$/i.test(url.pathname))
      .map((url) => url.href);
    await cache.addAll(appFiles);

    const stylesheetFiles = await Promise.all(appFiles.filter((path) => path.endsWith('.css')).map(async (path) => {
      const stylesheet = await (await cache.match(path)).text();
      return [...stylesheet.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
        .map((match) => new URL(match[1], path))
        .filter((url) => url.origin === self.location.origin)
        .map((url) => url.href);
    }));
    await cache.addAll(stylesheetFiles.flat());
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('yajman-pwa-') && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(appFile('index.html'), copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(appFile('index.html'))) ?? caches.match(appFile(''))),
    );
    return;
  }

  const cacheableRequest = ['script', 'style', 'font', 'image', 'worker'].includes(request.destination)
    || /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|svg|webmanifest|mp3|mp4)$/i.test(url.pathname);
  if (!cacheableRequest) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

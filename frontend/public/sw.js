const CACHE = 'tastera-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(SHELL);
    const html = await (await fetch('/index.html')).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map((match) => match[1]);
    if (assets.length) await cache.addAll(assets);
  }));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.mode === 'navigate' || SHELL.includes(url.pathname) || url.pathname.startsWith('/assets/'))) {
      const copy = response.clone();
      void caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === 'navigate' ? (await caches.match('/')) : Response.error())));
});

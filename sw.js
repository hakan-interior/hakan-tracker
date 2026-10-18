// Network-first service worker: keeps the app shell available offline, never caches team data.
const CACHE = 'hakan-shell-v2';
const SHELL = ['./', 'styles.css', 'app.js', 'backend.js', 'config.js', 'scene3d.js', 'assets/logo-taupe.png', 'assets/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only the app's own files; Supabase, CDNs and the local /api/ are always live.
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./')))
  );
});

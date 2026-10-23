// Service worker: keeps the app shell available offline (never caches team data)
// and shows phone notifications sent by the "send-push" Edge Function, even when the app is closed.
const CACHE = 'hakan-shell-v4';
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

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Hakan', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Hakan', {
    body: d.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: d.tag,
    renotify: true,
    data: { url: d.url || './#/notifications' },
  }));
});

// Tapping a notification opens the app on that room (or brings the open app to the front).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './#/notifications';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      try { await w.focus(); await w.navigate(url); return; } catch { /* try the next window */ }
    }
    await self.clients.openWindow(url);
  })());
});

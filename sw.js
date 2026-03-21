// FocusFlow Service Worker
// Caches the app shell for offline use

const CACHE = 'focusflow-v1';
const ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap',
];

// Install — cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(ASSETS.map(url => c.add(url).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for app shell, network-first for CDN assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and chrome-extension requests
  if (e.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // For the app HTML — cache first, fallback to network
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // For CDN resources (fonts, chart.js, pdf.js) — stale-while-revalidate
  if (url.hostname !== location.hostname) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Default — network with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

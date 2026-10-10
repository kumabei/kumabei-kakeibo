// Cache the app shell so the app opens offline. Bump VERSION (here and in js/version.js) on every release.
const VERSION = '1.1.3';
const CACHE = 'kumabei-kakeibo-' + VERSION;
// Kept JSON-compatible (double quotes, no trailing comma): tests/sw.test.js parses this list.
const FILES = [
  "./", "index.html", "manifest.json", "icon-180.png", "icon-512.png",
  "css/style.css",
  "js/app.js", "js/db.js", "js/state.js", "js/nav.js", "js/ui.js", "js/logic.js", "js/kuma.js",
  "js/lines.js", "js/version.js", "js/backup.js", "js/fixed.js", "js/stats.js", "js/chart.js", "js/report-nav.js",
  "js/screens/input.js", "js/screens/home.js", "js/screens/calendar.js", "js/screens/history.js",
  "js/screens/settings.js", "js/screens/fixed.js", "js/screens/report.js",
  "img/kuma/k01.png", "img/kuma/k02.png", "img/kuma/k06.png", "img/kuma/k07.png", "img/kuma/k08.png",
  "img/kuma/k09.png", "img/kuma/k10.png", "img/kuma/k12.png", "img/kuma/k14.png", "img/kuma/k15.png",
  "img/kuma/k16.png", "img/kuma/y01.png", "img/kuma/y02.png", "img/kuma/y03.png", "img/kuma/y04.png",
  "img/kuma/y08.png", "img/kuma/y09.png", "img/kuma/y15.png", "img/kuma/y18.png", "img/kuma/y19.png",
  "img/kuma/y22.png", "img/kuma/y24.png"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network first, fall back to cache: updates show up immediately when online.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

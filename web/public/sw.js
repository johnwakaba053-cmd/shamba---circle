// Shamba Space service worker.
//
// Deliberately minimal: it exists so the app is installable and shows a
// friendly offline page, NOT to cache the app. Every page in Shamba Space
// is dynamic and per-user (Supabase session cookies, signed media URLs,
// RLS-scoped data), so caching HTML, /_next assets, API responses or
// Supabase requests would risk serving stale or another session's
// content -- and in `next dev` those assets change on every edit.
//
// What it does:
//   - Precaches only /offline.html and one icon.
//   - For top-level page navigations: always goes to the network; only if
//     the network request itself fails (phone offline) does it show
//     /offline.html.
//   - Every other request (JS/CSS chunks, images, fetch/XHR, Supabase,
//     HMR in dev) is not intercepted at all -- the browser handles it
//     exactly as if there were no service worker.

const CACHE_NAME = "shamba-space-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode !== "navigate" || request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    }),
  );
});

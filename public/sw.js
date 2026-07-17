// TASK 14: minimal app-shell service worker for Sihha PWA.
// Cache-first for same-origin static assets; network-first for navigations
// with an offline fallback. Bumping CACHE_VERSION invalidates old caches.
const CACHE_VERSION = "sihha-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/brand/sihha-icon-primary.svg",
  "/brand/sihha-app-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Supabase, API, or auth traffic.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/auth")
  ) {
    return;
  }

  // Navigations: network-first, fall back to cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  // Static assets: cache-first with background revalidation.
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/brand/") ||
    /\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
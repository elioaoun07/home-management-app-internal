// PM Command Center service worker.
// Network-first with a cache fallback for the React shell, local JS/CSS and
// the PM data feed. Every successful load refreshes the cache, so
// opening the installed PWA away from your laptop (or with it off) falls back
// to the last-synced snapshot instead of failing outright — read-only, same
// UI. Everything else (mutations, SSE, source previews, delivery API) passes
// straight through untouched: those only make sense against a live server.
const CACHE = "pm-offline-v2";
const CACHEABLE = ["/", "/api/data", "/app/assets/pm.js", "/app/assets/pm.css"];

// The page load that registers this worker is never itself intercepted by
// it (standard SW behavior) — without this, the very first visit would
// leave the cache empty until a second reload happened to land after
// activation. Precaching here means the first successful visit is enough.
self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all(CACHEABLE.map((path) => stash(path).catch(() => {}))));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("pm-offline-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !CACHEABLE.includes(url.pathname)) return;
  const network = fetch(req);
  // Cache the copy in the background. A slow cache write or quota failure
  // cannot delay a fresh response or turn it into an offline fallback.
  event.waitUntil(network.then(response => stash(req, response)).catch(() => {}));
  event.respondWith(network.catch(() => cachedResponse(req)));
});

async function stash(req, response) {
  response ??= await fetch(req);
  if (!response.ok) return;
  const headers = new Headers(response.headers);
  headers.set("x-pm-cached-at", new Date().toISOString());
  const body = response.clone().body;
  const cache = await caches.open(CACHE);
  await cache.put(req, new Response(body, { status: response.status, statusText: response.statusText, headers }));
}

async function cachedResponse(req) {
  const cached = await caches.match(req, { cacheName: CACHE });
  if (!cached) throw new Error("offline and nothing cached yet");
  const headers = new Headers(cached.headers);
  headers.set("x-pm-offline", "1");
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}

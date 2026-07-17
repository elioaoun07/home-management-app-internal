// PM Command Center service worker.
// Network-first with a cache fallback for the app shell ("/") and the PM data
// feed ("/api/data") only. Every successful load refreshes the cache, so
// opening the installed PWA away from your laptop (or with it off) falls back
// to the last-synced snapshot instead of failing outright — read-only, same
// UI. Everything else (mutations, SSE, source previews, delivery API) passes
// straight through untouched: those only make sense against a live server.
const CACHE = "pm-offline-v1";
const CACHEABLE = ["/", "/api/data"];

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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if ((req.headers.get("accept") || "").includes("text/event-stream")) return;
  const path = new URL(req.url).pathname;
  event.respondWith(CACHEABLE.includes(path) ? networkFirst(req) : fetch(req));
});

async function stash(req) {
  const response = await fetch(req);
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("x-pm-cached-at", new Date().toISOString());
  const body = await response.clone().arrayBuffer();
  const cache = await caches.open(CACHE);
  await cache.put(req, new Response(body, { status: response.status, statusText: response.statusText, headers }));
  return response;
}

async function networkFirst(req) {
  try {
    return await stash(req);
  } catch {
    const cached = await caches.match(req);
    if (!cached) throw new Error("offline and nothing cached yet");
    const headers = new Headers(cached.headers);
    headers.set("x-pm-offline", "1");
    const body = await cached.clone().arrayBuffer();
    return new Response(body, { status: cached.status, statusText: cached.statusText, headers });
  }
}

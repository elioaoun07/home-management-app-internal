// Service Worker for Push Notifications + Offline Caching
// Handles push events, displays notifications with alarm-like behavior, and caches app shell

const SW_VERSION = "5.1.0";

// Minimal loading shell served immediately when no cached HTML is available.
// Embedded directly in the SW bundle — never lost even when Cache Storage is cleared by iOS.
// The shell auto-retries every 3 s and listens for the online event so the real
// app loads as soon as the network (or the server) is ready.
const INLINE_LOADING_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Budget Manager</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0a1628;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;-webkit-text-size-adjust:100%}
.wrap{display:flex;flex-direction:column;align-items:center;gap:18px;padding:40px 24px;text-align:center}
.spinner{width:44px;height:44px;border:3px solid rgba(99,102,241,.18);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.title{font-size:17px;font-weight:600;color:#e2e8f0;letter-spacing:.01em}
.msg{font-size:13px;color:rgba(255,255,255,.38)}
.btn{margin-top:4px;padding:10px 26px;border-radius:999px;background:rgba(99,102,241,.14);border:1px solid rgba(99,102,241,.28);color:#a5b4fc;font-size:13px;font-weight:500;cursor:pointer;-webkit-tap-highlight-color:transparent}
.btn:active{background:rgba(99,102,241,.26)}
</style>
</head>
<body>
<div class="wrap">
  <div class="spinner"></div>
  <div class="title">Budget Manager</div>
  <div class="msg" id="msg">Connecting\u2026</div>
  <button class="btn" onclick="go()">Try Now</button>
</div>
<script>
var t,n=0,max=20;
function go(){clearInterval(t);window.location.reload();}
function tick(){n++;if(n>=max){clearInterval(t);document.getElementById('msg').textContent='Tap \u201cTry Now\u201d to reload.';}else{document.getElementById('msg').textContent='Retrying in '+(3-((n-1)%3))+'\u2009s\u2026';if(n%3===0)go();}}
t=setInterval(tick,1000);
window.addEventListener('online',function(){setTimeout(go,400);});
</script>
</body>
</html>`;

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_NAME = "app-shell-v5";
const STATIC_CACHE = "static-assets-v1";
const API_CACHE = "api-cache-v1";

// Read-only API routes that are safe to cache with stale-while-revalidate.
// Mutations (/api/transactions POST, etc.) are never cached — only these GETs.
const CACHEABLE_API_PREFIXES = [
  "/api/accounts",
  "/api/user-preferences",
  "/api/categories",
  "/api/onboarding",
  "/api/drafts",
  "/api/future-payments",
];

// App shell assets to pre-cache on install
// CRITICAL: Include actual app pages so the PWA loads offline after closing/reopening
const SHELL_ASSETS = [
  "/offline",
  "/expense",
  "/dashboard",
  "/reminders",
  "/recurring",
  "/",
  "/appicon-192.png",
  "/appicon-512.png",
  "/manifest.json",
];

// Navigation timeout — if network doesn't respond within this window,
// serve from cache immediately. Prevents 30-120s hangs on slow connections.
// NOTE: getAdaptiveTimeout() is used at runtime for network-speed-aware timeouts.
const NAV_TIMEOUT_MS = 2500; // fallback for cold SW boot before getAdaptiveTimeout is defined

// Core app routes whose RSC payloads we cache for offline use
const CORE_ROUTES = ["/expense", "/dashboard", "/reminders", "/recurring", "/"];

// ============================================
// INSTALL & ACTIVATE
// ============================================

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker v" + SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Pre-caching app shell assets");
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn("[SW] Some shell assets failed to cache:", err);
        // Don't block install if some assets fail
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker v" + SW_VERSION);
  event.waitUntil(
    Promise.all([
      // Clean up old cache versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE_NAME && key !== STATIC_CACHE && key !== API_CACHE,
            )
            .map((key) => {
              console.log("[SW] Removing old cache:", key);
              return caches.delete(key);
            }),
        ),
      ),
      // Enable Navigation Preload — lets the browser start the network request
      // in parallel with SW boot, saving 100-500ms on cold starts.
      // Gracefully ignored on browsers that don't support it (Safari, Firefox).
      self.registration.navigationPreload &&
        self.registration.navigationPreload.enable().catch(() => {}),
      clients.claim(),
    ]),
  );
});

// ============================================
// NETWORK RACE HELPER — timeout-based fallback
// ============================================

/**
 * Returns an adaptive timeout in ms based on the detected network speed.
 * Prevents aborting 3G chunk downloads that need 4-8s to complete.
 */
function getAdaptiveTimeout() {
  try {
    const type = navigator.connection?.effectiveType;
    if (type === "4g") return 3000;
    if (type === "3g") return 8000;
    if (type === "2g" || type === "slow-2g") return 15000;
  } catch {}
  return 5000;
}

/**
 * Race a network fetch against a timeout. If the network doesn't respond
 * within `timeoutMs`, resolve with `undefined` so the caller can serve cache.
 * This prevents 30-120s hangs on slow/flaky connections.
 */
function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(request, { signal: controller.signal })
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      // Return undefined on timeout/network failure — caller falls back to cache
      return undefined;
    });
}

// ============================================
// FETCH HANDLER — Offline Caching Strategy
// ============================================

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (mutations go through online queue)
  if (request.method !== "GET") return;

  // Selective API caching: cache read-only endpoints with stale-while-revalidate.
  // All other /api/ routes (health checks, mutations endpoints) are skipped.
  if (url.pathname.startsWith("/api/")) {
    const isCacheable = CACHEABLE_API_PREFIXES.some((prefix) =>
      url.pathname.startsWith(prefix),
    );
    if (isCacheable) {
      event.respondWith(
        (async () => {
          const cached = await caches.match(request);
          // Stale-while-revalidate: return cache immediately, refresh in background
          const fetchPromise = fetch(request)
            .then((freshResponse) => {
              if (freshResponse && freshResponse.ok) {
                caches
                  .open(API_CACHE)
                  .then((cache) => cache.put(request, freshResponse.clone()));
              }
              return freshResponse;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })(),
      );
    }
    return;
  }

  // Skip Supabase requests
  if (url.hostname.includes("supabase")) return;

  // Google Fonts CSS — stale-while-revalidate (served fresh but cached for offline)
  if (url.hostname === "fonts.googleapis.com") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request, { mode: "cors" })
          .then((response) => {
            if (
              response &&
              (response.type === "basic" || response.type === "cors") &&
              response.ok
            ) {
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      }),
    );
    return;
  }

  // Google Fonts binary files — cache-first (URL-versioned, immutable)
  if (url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request, { mode: "cors" }).then((response) => {
          if (
            response &&
            (response.type === "basic" || response.type === "cors") &&
            response.ok
          ) {
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, response.clone()));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Skip all other cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Static assets (/_next/static/) — Cache-first (immutable, fingerprinted)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Images & icons — Stale-while-revalidate
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/) ||
    url.pathname.startsWith("/appicon")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      }),
    );
    return;
  }

  // Navigation requests (HTML pages) — Stale-while-revalidate
  // Serve from cache IMMEDIATELY if available, update in background.
  // Only block on network for cold loads (no cache yet).
  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(
      (async () => {
        // Navigation Preload — browser started this in parallel with SW boot (100-500ms faster cold loads)
        const preloadResponse = event.preloadResponse
          ? await event.preloadResponse.catch(() => undefined)
          : undefined;

        if (preloadResponse && preloadResponse.ok) {
          const clone = preloadResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return preloadResponse;
        }

        // Serve from cache IMMEDIATELY if available — no waiting
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Stale-while-revalidate: update cache in background, return cache now
          fetch(request)
            .then((freshResponse) => {
              if (freshResponse && freshResponse.ok) {
                caches
                  .open(CACHE_NAME)
                  .then((cache) => cache.put(request, freshResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // No cache — cold start (SW was killed by iOS or cache cleared).
        // Serve the inline loading shell IMMEDIATELY (zero network latency) so the
        // user sees a spinner instead of a white screen. Simultaneously kick off a
        // background network fetch; when it succeeds the shell's auto-retry loop
        // will pick up the freshly cached page on its next reload.
        fetch(request)
          .then((r) => {
            if (r && r.ok) {
              const clone = r.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
          })
          .catch(() => {});

        return new Response(INLINE_LOADING_SHELL, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })(),
    );
    return;
  }

  // RSC payloads — Stale-while-revalidate (serve cache instantly, refresh in background)
  // Other /_next/ — Network-first with 3s timeout (reduced from 5s)
  if (url.pathname.startsWith("/_next/")) {
    const isRSC = url.pathname.includes(".rsc") || url.searchParams.has("_rsc");

    if (isRSC) {
      event.respondWith(
        (async () => {
          const cached = await caches.match(request);
          if (cached) {
            // Serve cache immediately, update in background
            fetch(request)
              .then((freshResponse) => {
                if (freshResponse && freshResponse.ok) {
                  caches
                    .open(STATIC_CACHE)
                    .then((cache) => cache.put(request, freshResponse));
                }
              })
              .catch(() => {});
            return cached;
          }
          // No cache — fetch with adaptive timeout
          const networkResponse = await fetchWithTimeout(
            request,
            getAdaptiveTimeout(),
          );
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches
              .open(STATIC_CACHE)
              .then((cache) => cache.put(request, clone));
            return networkResponse;
          }
          // Serve cached HTML for this route rather than empty JSON (which crashes RSC parser)
          const htmlFallback = await caches.match(
            new URL(request.url).pathname,
          );
          if (htmlFallback) return htmlFallback;
          return new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        })(),
      );
      return;
    }

    // Non-RSC /_next/ — network-first with adaptive timeout
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const networkResponse = await fetchWithTimeout(
          request,
          getAdaptiveTimeout(),
        );

        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return networkResponse;
        }

        if (cached) return cached;
        return new Response("", { status: 504 });
      })(),
    );
    return;
  }
});

// ============================================
// ALARM SOUND - Notify clients to play sound
// ============================================

async function notifyClientsToPlaySound(data) {
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  console.log(
    "[SW] Notifying",
    allClients.length,
    "clients to play alarm sound",
  );

  for (const client of allClients) {
    client.postMessage({
      type: "PLAY_ALARM_SOUND",
      data: data,
    });
  }

  // If no clients are open, we can't play sound directly
  // The notification vibration will have to suffice
  if (allClients.length === 0) {
    console.log("[SW] No clients open - relying on system notification sound");
  }
}

// ============================================
// PUSH NOTIFICATION HANDLING
// ============================================

self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event);

  let data = {
    title: "Reminder",
    body: "You have a reminder",
    icon: "/appicon-192.png",
    badge: "/appicon-192.png",
    tag: "reminder-" + Date.now(),
    data: {},
  };

  // Parse push data
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      data.body = event.data.text();
    }
  }

  const notifType = data.data?.type;

  // Create notification options based on type
  const options = {
    body: data.body,
    icon: data.icon || "/appicon-192.png",
    badge: data.badge || "/appicon-192.png",
    tag: data.tag,
    data: data.data,
    requireInteraction: true,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
  };

  // ── Per-type actions & vibration ──
  // iOS ignores actions automatically; Android displays them as quick-action buttons.

  if (notifType === "transaction_reminder" || notifType === "daily_reminder") {
    // Daily / transaction reminder → gentle vibration
    options.vibrate = [200, 100, 200];
    options.actions = [
      {
        action: "add_expense",
        title: "➕ Log Expense",
        icon: "/appicon-192.png",
      },
      { action: "snooze_1h", title: "⏰ Later", icon: "/appicon-192.png" },
    ];
  } else if (
    notifType === "item_reminder" ||
    notifType === "item_due" ||
    notifType === "item_overdue"
  ) {
    // Task / reminder / event → alarm vibration
    options.vibrate = [500, 200, 500, 200, 500, 200, 500, 200, 500];
    options.actions = [
      { action: "complete_item", title: "✅ Done", icon: "/appicon-192.png" },
      { action: "snooze", title: "⏰ Snooze", icon: "/appicon-192.png" },
    ];
    options.timestamp = data.data?.due_at
      ? new Date(data.data.due_at).getTime()
      : Date.now();
  } else if (notifType === "chat_message" || notifType === "chat_mention") {
    // Chat message → gentle vibration
    options.vibrate = [200, 100, 200];
    options.actions = [
      { action: "open_thread", title: "💬 Open", icon: "/appicon-192.png" },
      { action: "snooze", title: "⏰ Snooze", icon: "/appicon-192.png" },
    ];
  } else if (notifType === "transaction_pending") {
    // Split bill request → gentle vibration
    options.vibrate = [200, 100, 200, 100, 200];
    options.actions = [
      {
        action: "open_split_bill",
        title: "💰 Add Amount",
        icon: "/appicon-192.png",
      },
      { action: "snooze_1h", title: "⏰ Later", icon: "/appicon-192.png" },
    ];
  } else if (notifType === "bill_due" || notifType === "bill_overdue") {
    // Recurring bill due → medium vibration
    options.vibrate = [300, 150, 300, 150, 300];
    options.actions = [
      {
        action: "open_recurring",
        title: "✅ Confirm",
        icon: "/appicon-192.png",
      },
      { action: "snooze", title: "⏰ Snooze", icon: "/appicon-192.png" },
    ];
  } else if (notifType === "guest_chat") {
    // Guest portal chat → gentle vibration
    options.vibrate = [200, 100, 200];
    options.actions = [
      { action: "snooze", title: "⏰ Snooze", icon: "/appicon-192.png" },
      { action: "dismiss", title: "✓ Dismiss", icon: "/appicon-192.png" },
    ];
  } else if (notifType === "test") {
    // Test notification → gentle, no actions
    options.vibrate = [200, 100, 200];
    options.actions = [];
    options.requireInteraction = false;
  } else {
    // Unknown type → default snooze/dismiss
    options.vibrate = [300, 150, 300];
    options.actions = [
      { action: "snooze", title: "⏰ Snooze 5min", icon: "/appicon-192.png" },
      { action: "dismiss", title: "✓ Dismiss", icon: "/appicon-192.png" },
    ];
  }

  // Determine if we should play alarm sound (only for item reminders)
  const shouldPlayAlarm =
    notifType === "item_reminder" ||
    notifType === "item_due" ||
    notifType === "item_overdue";

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      shouldPlayAlarm ? notifyClientsToPlaySound(data) : Promise.resolve(),
    ]),
  );
});

// ============================================
// NOTIFICATION CLICK HANDLING
// ============================================

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action, event.notification);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const notifType = data.type;

  // Close the notification
  notification.close();

  // ── Action button clicks (Android quick actions) ──

  if (action === "snooze") {
    event.waitUntil(handleSnooze(data, 5));
    return;
  }
  if (action === "snooze_1h") {
    event.waitUntil(handleSnooze(data, 60));
    return;
  }
  if (action === "snooze_3h") {
    event.waitUntil(handleSnooze(data, 180));
    return;
  }
  if (action === "dismiss") {
    event.waitUntil(handleDismiss(data));
    return;
  }
  if (action === "confirm_transactions") {
    event.waitUntil(handleConfirmTransactions(data));
    return;
  }
  if (action === "add_expense") {
    // Open expense tab
    event.waitUntil(openApp({ ...data, url: "/expense?action=add-expense" }));
    return;
  }
  if (action === "complete_item") {
    // Complete item via API, then show confirmation
    event.waitUntil(handleCompleteItem(data));
    return;
  }
  if (action === "open_thread") {
    // Open standalone chat page with thread
    const threadId = data.thread_id;
    event.waitUntil(
      openApp({
        ...data,
        url: threadId ? `/chat?thread=${threadId}` : "/chat",
      }),
    );
    return;
  }
  if (action === "open_split_bill") {
    event.waitUntil(openApp({ ...data, url: "/expense?action=split-bill" }));
    return;
  }
  if (action === "open_recurring") {
    event.waitUntil(openApp({ ...data, url: "/recurring" }));
    return;
  }
  if (action === "settings") {
    event.waitUntil(openApp({ ...data, url: "/settings" }));
    return;
  }

  // ── Default body click (no action button) ──
  // Route based on notification type to the correct page/tab

  if (notifType === "transaction_reminder" || notifType === "daily_reminder") {
    // Open expense tab (the main entry form)
    event.waitUntil(openApp({ ...data, url: "/expense" }));
  } else if (
    notifType === "item_reminder" ||
    notifType === "item_due" ||
    notifType === "item_overdue"
  ) {
    // Open reminder tab, optionally highlighting a specific item
    const itemUrl = data.item_id
      ? `/expense?tab=reminder&item=${data.item_id}`
      : "/expense?tab=reminder";
    event.waitUntil(openApp({ ...data, url: itemUrl }));
  } else if (notifType === "chat_message" || notifType === "chat_mention") {
    // Open standalone chat page with the thread
    const threadId = data.thread_id;
    event.waitUntil(
      openApp({
        ...data,
        url: threadId ? `/chat?thread=${threadId}` : "/chat",
      }),
    );
  } else if (notifType === "transaction_pending") {
    // Split bill → open expense with action
    event.waitUntil(openApp({ ...data, url: "/expense?action=split-bill" }));
  } else if (notifType === "bill_due" || notifType === "bill_overdue") {
    // Open recurring payments page
    event.waitUntil(openApp({ ...data, url: "/recurring" }));
  } else if (notifType === "guest_chat") {
    // Open hub tab (guest messages show in hub alerts)
    event.waitUntil(openApp({ ...data, url: "/expense?tab=hub&view=alerts" }));
  } else if (
    notifType === "budget_warning" ||
    notifType === "budget_exceeded"
  ) {
    // Open dashboard tab
    event.waitUntil(openApp({ ...data, url: "/expense?tab=dashboard" }));
  } else if (notifType === "goal_milestone" || notifType === "goal_completed") {
    // Open hub tab
    event.waitUntil(openApp({ ...data, url: "/expense?tab=hub" }));
  } else if (notifType === "test") {
    // Test notification → just open the app
    event.waitUntil(openApp({ ...data, url: "/expense" }));
  } else {
    // Unknown type → open app at whatever URL was provided, or default to /expense
    event.waitUntil(openApp(data));
  }
});

// Handle notification close without interaction
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification);
  // Could track dismissed notifications here
});

// ============================================
// PUSH SUBSCRIPTION CHANGE (Android FCM token rotation)
// ============================================
// Android Chrome/FCM periodically rotates push tokens. When this happens,
// the browser fires `pushsubscriptionchange` so the app can re-register.
// Without this handler, the old token goes stale and all pushes silently fail.

self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] pushsubscriptionchange fired — FCM token likely rotated");
  event.waitUntil(handlePushSubscriptionChange(event));
});

async function handlePushSubscriptionChange(event) {
  try {
    const oldEndpoint = event.oldSubscription
      ? event.oldSubscription.endpoint
      : null;

    let newSubscription = event.newSubscription || null;

    // If the browser didn't supply a new subscription, create one ourselves
    if (!newSubscription) {
      const vapidKey = await getStoredVapidKey();
      if (!vapidKey) {
        console.error(
          "[SW] No VAPID key cached — cannot re-subscribe. User must re-enable notifications manually.",
        );
        notifyClientsSubscriptionLost();
        return;
      }

      try {
        newSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        console.log(
          "[SW] Re-subscribed with new endpoint:",
          newSubscription.endpoint.substring(0, 50),
        );
      } catch (err) {
        console.error("[SW] Failed to re-subscribe:", err);
        notifyClientsSubscriptionLost();
        return;
      }
    }

    const subData = newSubscription.toJSON();

    // First, try to notify open clients — they can re-sync via the normal subscribe flow
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    if (clients.length > 0) {
      console.log(
        "[SW] Notifying",
        clients.length,
        "client(s) about subscription change",
      );
      clients.forEach((client) => {
        client.postMessage({
          type: "SUBSCRIPTION_CHANGED",
          endpoint: subData.endpoint,
          p256dh: subData.keys?.p256dh,
          auth: subData.keys?.auth,
        });
      });
      // Clients will sync via usePushNotifications.ts → syncSubscriptionToDb()
      return;
    }

    // No clients open — SW must sync the new subscription directly
    console.log(
      "[SW] No clients open — syncing subscription change directly to server",
    );
    const response = await fetch("/api/notifications/subscribe/sw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subData.endpoint,
        p256dh: subData.keys?.p256dh,
        auth: subData.keys?.auth,
        old_endpoint: oldEndpoint,
      }),
    });

    if (response.ok) {
      console.log("[SW] Subscription change synced to server successfully");
    } else {
      const text = await response.text().catch(() => "");
      console.error(
        "[SW] Failed to sync subscription change:",
        response.status,
        text,
      );
    }
  } catch (err) {
    console.error("[SW] Error in handlePushSubscriptionChange:", err);
  }
}

function notifyClientsSubscriptionLost() {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "SUBSCRIPTION_LOST" });
      });
    });
}

// Read VAPID public key from IndexedDB (stored by usePushNotifications.ts on first subscribe)
async function getStoredVapidKey() {
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open("push-config", 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore("config");
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction("config", "readonly");
        const store = tx.objectStore("config");
        const get = store.get("vapidPublicKey");
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================
// PERIODIC BACKGROUND SYNC (Android subscription health check)
// ============================================
// Chrome on Android supports Periodic Background Sync for installed PWAs.
// This wakes the SW ~once per day even when the app is closed, allowing us to
// detect and heal dead FCM subscriptions without the user opening the app.
//
// Registration happens in usePushNotifications.ts after a successful subscribe.

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "push-health-check") {
    console.log("[SW] Periodic push health check triggered");
    event.waitUntil(periodicPushHealthCheck());
  }
});

async function periodicPushHealthCheck() {
  try {
    // Get the current subscription the browser has
    const subscription = await self.registration.pushManager.getSubscription();

    if (!subscription) {
      console.log("[SW] Periodic health check: no local subscription — nothing to do");
      return;
    }

    // Ask the server if this endpoint is healthy
    const response = await fetch("/api/notifications/subscription-health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    if (!response.ok) {
      console.warn("[SW] Health check API error:", response.status);
      return;
    }

    const { needs_resubscribe, reason } = await response.json();

    if (!needs_resubscribe) {
      console.log("[SW] Periodic health check: subscription is healthy ✓");
      return;
    }

    console.log(`[SW] Periodic health check: subscription needs renewal (reason: ${reason}) — re-subscribing`);

    // Retrieve cached VAPID key (stored by usePushNotifications on first subscribe)
    const vapidKey = await getStoredVapidKey();
    if (!vapidKey) {
      console.error("[SW] No VAPID key cached — cannot re-subscribe autonomously");
      notifyClientsSubscriptionLost();
      return;
    }

    const oldEndpoint = subscription.endpoint;

    // Unsubscribe the dead token and get a fresh one from FCM
    await subscription.unsubscribe();

    let newSubscription;
    try {
      newSubscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    } catch (err) {
      console.error("[SW] Periodic health check: failed to re-subscribe:", err);
      return;
    }

    // Accept the new subscription regardless of whether the endpoint changed.
    // Re-subscribing re-registers the token at FCM even if the URL is the same.
    if (newSubscription.endpoint === oldEndpoint) {
      console.log("[SW] Periodic health check: Chrome returned same endpoint — re-registered at FCM, proceeding.");
    } else {
      console.log("[SW] Periodic health check: new endpoint obtained:", newSubscription.endpoint.substring(0, 50));
    }

    // If the app is open, let the client handle the sync (normal subscribe flow with auth)
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (clients.length > 0) {
      clients.forEach((client) => {
        client.postMessage({
          type: "SUBSCRIPTION_CHANGED",
          endpoint: newSubscription.toJSON().endpoint,
          p256dh: newSubscription.toJSON().keys?.p256dh,
          auth: newSubscription.toJSON().keys?.auth,
        });
      });
      return;
    }

    // App is closed — sync directly using the SW route (auth via old_endpoint)
    const syncResponse = await fetch("/api/notifications/subscribe/sw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: newSubscription.toJSON().endpoint,
        p256dh: newSubscription.toJSON().keys?.p256dh,
        auth: newSubscription.toJSON().keys?.auth,
        old_endpoint: oldEndpoint,
      }),
    });

    if (syncResponse.ok) {
      console.log("[SW] Periodic health check: subscription healed successfully ✓");
    } else {
      console.error("[SW] Periodic health check: failed to sync new subscription:", syncResponse.status);
    }
  } catch (err) {
    console.error("[SW] Periodic health check error:", err);
  }
}

// ============================================
// ACTION HANDLERS
// ============================================

async function handleSnooze(data, minutes = 5) {
  console.log("[SW] Snoozing notification for", minutes, "minutes:", data);

  // Try to send snooze request to server
  try {
    // Use notification_id for unified notifications
    if (data.notification_id) {
      const response = await fetch("/api/notifications/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_id: data.notification_id,
          snooze_minutes: minutes,
        }),
      });

      if (!response.ok) {
        console.error("[SW] Failed to snooze:", await response.text());
      }
    } else if (data.item_id && data.alert_id) {
      // Legacy: item alerts
      const response = await fetch("/api/notifications/snooze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: data.item_id,
          alert_id: data.alert_id,
          snooze_minutes: minutes,
        }),
      });

      if (!response.ok) {
        console.error("[SW] Failed to snooze:", await response.text());
      }
    }
  } catch (error) {
    console.error("[SW] Error snoozing:", error);
  }

  // Format snooze time for display
  const timeDisplay =
    minutes >= 60
      ? `${minutes / 60} hour${minutes > 60 ? "s" : ""}`
      : `${minutes} minutes`;

  // Show a confirmation notification
  await self.registration.showNotification("Snoozed", {
    body: `Reminder snoozed for ${timeDisplay}`,
    icon: "/appicon-192.png",
    tag: "snooze-confirm",
    requireInteraction: false,
    silent: true,
  });
}

async function handleDismiss(data) {
  console.log("[SW] Dismissing notification:", data);

  // Try to mark as dismissed on server
  try {
    if (data.notification_log_id) {
      await fetch("/api/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_log_id: data.notification_log_id,
        }),
      });
    }
  } catch (error) {
    console.error("[SW] Error dismissing:", error);
  }
}

// Handle "Yes, all done!" action for transaction reminders
async function handleConfirmTransactions(data) {
  console.log("[SW] Confirming transactions:", data);

  try {
    const response = await fetch("/api/notifications/transaction-reminder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm",
        notification_id: data.notification_id,
        alert_id: data.alert_id, // Legacy fallback
      }),
    });

    if (response.ok) {
      // Show a celebratory confirmation
      await self.registration.showNotification("Great job! 🎉", {
        body: "Your finances are up to date!",
        icon: "/appicon-192.png",
        tag: "transaction-confirm",
        requireInteraction: false,
        silent: true,
      });
    }
  } catch (error) {
    console.error("[SW] Error confirming transactions:", error);
  }
}

// Handle "Not yet" action - open add expense form
async function openAddExpense(data) {
  console.log("[SW] Opening add expense:", data);
  await openApp({ ...data, url: "/expense?action=add-expense" });
}

// Handle "Complete Item" action from notification quick action (Android)
async function handleCompleteItem(data) {
  console.log("[SW] Completing item from notification:", data);

  if (!data.item_id) {
    console.error("[SW] No item_id in notification data");
    return;
  }

  try {
    const response = await fetch(`/api/items/${data.item_id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occurrence_date:
          data.occurrence_date || new Date().toISOString().split("T")[0],
        is_recurring: data.is_recurring || false,
      }),
    });

    if (response.ok) {
      await self.registration.showNotification("✅ Completed!", {
        body: data.item_title || "Task marked as done",
        icon: "/appicon-192.png",
        tag: "complete-confirm",
        requireInteraction: false,
        silent: true,
      });
    } else {
      console.error("[SW] Failed to complete item:", await response.text());
      // Fall back to opening the app
      await openApp({
        ...data,
        url: `/expense?tab=reminder&item=${data.item_id}`,
      });
    }
  } catch (error) {
    console.error("[SW] Error completing item:", error);
    await openApp({
      ...data,
      url: `/expense?tab=reminder&item=${data.item_id}`,
    });
  }
}

async function openApp(data) {
  console.log("[SW] Opening app:", data);

  // Determine URL to open - default to /expense (the main app page)
  let url = data.url || "/expense";

  // Try to focus existing window or open new one
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  // Check if app is already open
  for (const client of clients) {
    if (client.url.includes(self.location.origin)) {
      await client.focus();
      // Always send NAVIGATE so DeepLinkHandler can process params
      client.postMessage({
        type: "NAVIGATE",
        url: url,
      });
      return;
    }
  }

  // Open new window
  await self.clients.openWindow(url);
}

// ============================================
// PERIODIC SYNC (for background checking)
// ============================================

// This would be used for periodic background sync if supported
self.addEventListener("periodicsync", (event) => {
  console.log("[SW] Periodic sync:", event.tag);

  if (event.tag === "check-reminders") {
    event.waitUntil(checkPendingReminders());
  }
});

async function checkPendingReminders() {
  console.log("[SW] Checking pending reminders...");
  // This would ping the server to check for any due reminders
  // For now, we rely on push notifications from the server
}

// ============================================
// MESSAGE HANDLING
// ============================================

self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  const { type, payload } = event.data || {};

  switch (type) {
    case "WARM_CACHE":
      // Background-cache all JS chunks collected from the main thread.
      // Runs after first page load so subsequent visits are instant from SW cache.
      if (Array.isArray(payload?.urls)) {
        caches.open(STATIC_CACHE).then((cache) => {
          payload.urls.forEach((url) => {
            caches.match(url).then((hit) => {
              if (!hit)
                fetch(url)
                  .then((r) => {
                    if (r.ok) cache.put(url, r);
                  })
                  .catch(() => {});
            });
          });
        });
      }
      break;
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "GET_VERSION":
      event.ports[0]?.postMessage({ version: SW_VERSION });
      break;
    case "TEST_NOTIFICATION":
      // For testing notifications locally
      self.registration.showNotification(
        payload?.title || "Test Notification",
        {
          body: payload?.body || "This is a test notification",
          icon: "/appicon-192.png",
          badge: "/appicon-192.png",
          requireInteraction: true,
          vibrate: [500, 200, 500, 200, 500],
          actions: [
            { action: "snooze", title: "⏰ Snooze 5min" },
            { action: "dismiss", title: "✓ Dismiss" },
          ],
        },
      );
      break;
  }
});

console.log("[SW] Service worker loaded v" + SW_VERSION);

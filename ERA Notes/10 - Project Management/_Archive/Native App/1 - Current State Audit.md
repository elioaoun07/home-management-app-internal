# 1 — Current State Audit

**Stamped:** 2026-07-11 · Evidence gathered by three exploration passes over the repo + live web-policy checks. Every claim below names its source file. Delta with `git log --since=2026-07-11` before trusting during implementation.

---

## 1. Framework, build, deployment

| Fact | Evidence |
|---|---|
| Next.js **16.0.7**, React **19.1.0**, TypeScript ^5, pnpm, Turbopack build | `package.json` |
| No PWA plugin — service worker is hand-written | `public/sw.js` (v5.3.0, ~1400 lines), registered by `src/components/ServiceWorkerRegistration.tsx` (production-only) |
| Deployed on **Vercel** (no config committed) | no `vercel.json`/Dockerfile; `src/app/api/health/route.ts` comment "fast cold-start on Vercel" |
| **Cron schedule lives outside the repo** | 6 routes under `src/app/api/cron/` triggered by an external scheduler with `Bearer CRON_SECRET`; no `vercel.json`, no `pg_cron` in migrations |
| Node engine not pinned | no `engines`, `.nvmrc` — pin before CI work |

### Why the frontend is NOT statically exportable today

These are the hard blockers to `output: "export"` — they define why Stage 1 uses a remote shell (see doc 2) and what Stage 2 must refactor:

1. **Active middleware** — root `proxy.ts` (Next 16's middleware) refreshes the Supabase session cookie on every matched request.
2. **Server-gated RSC pages** — `src/app/layout.tsx`, `dashboard/page.tsx`, `expense/page.tsx` etc. read cookies via `supabaseServerRSC()` and `redirect("/login")`; several use `dynamic = "force-dynamic"`.
3. **One server action** — `src/app/login/actions.ts` (`signInWithPassword` + redirect).
4. **186 API route handlers** in 49 groups under `src/app/api/` — the backend *is* this app. One edge route (`/api/health`).
5. `next/image` with default loader — but only in **1 file** (`src/components/hub/ProductComparisonSheet.tsx`); trivially fixable.
6. No `generateStaticParams` anywhere (dynamic routes render on demand).

## 2. Authentication & session

- **Cookie-session only** via `@supabase/ssr` ^0.7.0: browser client `src/lib/supabase/client.ts` (`createBrowserClient`, singleton, default cookie storage), server clients `src/lib/supabase/server.ts` (`supabaseServer` read/write, `supabaseServerRSC` read-only).
- **Email + password only.** No OAuth, no magic link (`src/app/login/`, `src/app/api/auth/*`). The `gcal` OAuth callback is Google-Calendar-integration, not login.
- API routes authenticate with `supabaseServer(await cookies()).auth.getUser()` (network-validated) — 293 occurrences across 166 route files, all flowing through the **single helper** `src/lib/supabase/server.ts`. Pages gate on `getSession()` (cookie-trusting, deliberate for slow-3G); the real security boundary is the API layer.
- **No user-facing bearer-token path exists.** `Authorization: Bearer` is only used by cron routes against `CRON_SECRET`.
- Session refresh: `proxy.ts` on navigation + `@supabase/ssr` auto-refresh; `offlineSyncEngine` refreshes before queue replay.

## 3. Push notification pipeline (the contract Stage 1 must preserve)

```
cron/API  →  src/lib/pushSender.ts::sendPushToUser()          [single send choke point]
          →  web-push npm (VAPID) → browser push service
          →  public/sw.js "push" handler                       [per-data.type rendering]
          →  notificationclick → URL → NAVIGATE message
          →  src/components/DeepLinkHandler.tsx → TabContext   [pendingItemId / pendingThreadId]
```

- `push_subscriptions` (schema.sql:559–574): `endpoint`/`p256dh`/`auth` **all NOT NULL**, one row per `device_id`, lifecycle = `is_active`/`failed_at`/`last_used_at`; sender deactivates on HTTP 410/404.
- Client: `src/hooks/usePushNotifications.ts` — heavily hardened (device-id in localStorage, dead-endpoint resubscribe, VAPID key cached in IndexedDB for SW self-heal, periodic `push-health-check`).
- Payload contract: `{ title, body, icon, badge, tag, data: { type, notification_id, action_url } }` — `data.type` (≈15 values: `item_reminder`, `chat_message`, `bill_due`, …) selects actions/vibration/deep-link. **This contract is the native integration surface.**
- SW action buttons call APIs directly (`/api/notifications/snooze`, `/api/items/{id}/complete`, …) without opening the app.
- Senders: 4 cron routes + `notifications/in-app`, `send-due`, `test`, hub messages, guest chat.

## 4. Offline stack (Stage 1 inherits this unchanged)

| Layer | File | Behavior |
|---|---|---|
| Op queue | `src/lib/offlineQueue.ts` | IndexedDB `budget-offline`, max 200 ops, update-dedup, create+delete cancellation |
| Replay | `src/lib/offlineSyncEngine.ts` | FIFO fetch replay; 2xx remove, 4xx drop, 5xx retry (max 5), network-error stop; auth refresh first; tempId→realId swap |
| Query cache | `src/app/providers.tsx` | TanStack persister → localStorage `hm-rq-cache-v3`, **whitelist only** (accounts, categories, balances, prefs, recurring…); transactions/dashboard-stats excluded (quota) but have manual localStorage caches |
| Connectivity | `src/lib/connectivityManager.ts` | probes `HEAD /api/health` (30s/5s), `isReallyOnline()`, never trusts `navigator.onLine` |
| Fetch guard | `src/lib/safeFetch.ts` | pre-flight online check, timeout, `markOffline()` |
| Shell cache | `public/sw.js` | precache + SWR navigations + inline loading shell (iOS eviction resilience) |

- **Offline WRITES exist for exactly 5 features**: transactions, items, subtasks, recurring-confirm, hub messages (+ legacy localStorage queue for hub shopping only). Everything else is online-only.
- **Conflict handling: last-write-wins.** No version columns, no `updated_at` preconditions, no If-Match. Mitigations that exist: update-dedup, create+delete cancellation, recycle bin for recovery.

## 5. Realtime

- Hub chat/shopping: Supabase **broadcast** channels (`thread-*`, `household-*`) — deliberately not `postgres_changes` (RLS-subquery issues, comment at `src/features/hub/hooks.ts:438`).
- Notifications bell: `postgres_changes` on `notifications` (`src/hooks/useNotifications.ts:147`).
- Both run on the browser-client singleton → work identically inside a WebView.

## 6. Device/browser API inventory (native-relevance map)

| API | Used? | Where | Native implication |
|---|---|---|---|
| Web Push | ✅ | see §3 | **Must be replaced by FCM/APNs in shells** — pushManager doesn't exist in WebViews |
| `navigator.vibrate` | ✅ ~30 files | FAB, swipes, forms | Works in Android WebView; **no-op in WKWebView** → haptics bridge |
| getUserMedia + Azure Speech SDK | ✅ | `src/features/voice-conversation/` (token proxy `/api/azure-speech/token`) | Works in WKWebView ≥ iOS 14.3 with `NSMicrophoneUsageDescription` |
| Web Speech (STT/wake) | ✅ | `useEraWakeListener`, watch, forms | WebView support varies; wake word stays parked (ERA Awakening) |
| Camera | ✅ | `<input capture="environment">` (receipts, catalogue) | Works in WebViews given camera permission plumbing |
| Web Share | ✅ 1 file | `CatalogueItemDetailDialog` | Plugin later if needed |
| Clipboard | ✅ | NFC admin, guest portal | Works |
| **Geolocation** | ❌ none | — | New capability, not a port (doc 3 §5) |
| **Web NFC** | ❌ none | tags carry URLs; `era_nfc_redirect` cookie bridge (`nfc-tap-client.tsx`, `DeepLinkHandler.tsx:47-58`) | Native NFC + Universal Links replace the bridge (doc 3) |
| Wake lock / barcode / share-target | ❌ | — | — |

## 7. PWA surface

- Root `public/manifest.json` (start_url `/expense`, standalone) + **9 per-route manifests** (`public/manifests/*.webmanifest` — expense, dashboard, chat, watch, …) forming a multi-PWA setup. Untouched by this plan; browsers keep them.
- Safe-area is **already handled**: `viewport-fit`/`env(safe-area-inset-*)` in `src/app/globals.css` + 9 components → the UI is notch-ready for shells.
- CSP (`next.config.ts`): `script-src 'self' 'unsafe-inline'`, dynamic `connect-src` incl. Supabase origin. Native bridge injection is unaffected (native-side user scripts bypass page CSP); note in doc 6 if CSP ever moves to nonces.
- Origin assumptions are minimal: only 2 files reference `NEXT_PUBLIC_APP_URL` (`src/app/auth/reset/page.tsx`, `api/notifications/send-due`); data calls are relative → safe under a remote-URL shell.

## 8. Gaps this plan must address or document

1. **Cron schedule not in version control** — pin the external schedule into the vault during Phase 0.
2. **No bearer auth** — fine for Stage 1 (cookies in WebView), required work for Stage 2.
3. **LWW conflicts** — acceptable for a 2-user household; optional hardening spec'd in doc 3 §3.
4. **Node/engines unpinned** — pin when adding native tooling.
5. **iOS PWA storage fragility** (Safari eviction) — one of the reasons native improves the partner's experience (WKWebView data store is app-owned).

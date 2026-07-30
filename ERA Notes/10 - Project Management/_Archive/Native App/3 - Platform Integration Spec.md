# 3 — Platform Integration Spec

**Stamped:** 2026-07-11 · Covers plan sections: offline-first architecture (5), sync & conflicts (6), auth per platform (7), notifications (8), geolocation & background (9), libraries/plugins (14), security (15), plus the bridge-module design.

---

## 1. Authentication per platform

| Surface | Mechanism | Change required |
|---|---|---|
| Web (laptop/tablet) | `@supabase/ssr` cookies + `proxy.ts` refresh | None |
| Native Stage 1 (both phones) | **Identical cookie session inside the WebView, against the mobile deployment's origin.** The shell loads `era-mobile`'s domain, so `sb-*` chunked cookies are first-party there; they persist in `WKWebsiteDataStore.default` (iOS) / Android cookie store — app-owned storage, **not** subject to Safari ITP eviction → expected *more* stable than the current iOS PWA. Web and mobile sessions are independent Supabase sessions (different cookie jars) — one extra login at onboarding, then permanent | Config only: add the mobile domain to Supabase Auth's redirect allow-list; set `NEXT_PUBLIC_APP_URL` = mobile domain on the `era-mobile` project |
| Native Stage 2 | supabase-js with native storage (Capacitor Preferences) sending `Authorization: Bearer` | Bearer fallback in `src/lib/supabase/server.ts` (single choke point), CORS in `proxy.ts` |

- Password-reset emails: `redirectTo` already points at the app domain → with Universal Links (Phase 4) the link opens the native app directly. Until then it opens the browser — acceptable.
- No OAuth exists (audit §2), so no redirect flows to port. **Standing rule if OAuth is ever added:** system browser + deep-link callback (`signInWithOAuth` + `skipBrowserRedirect`), never inside the WebView — Google blocks WebView logins.
- Logout/user-switch: `providers.tsx` cache-wipe logic runs identically in the shells.

## 2. Offline-first data architecture

**Stage 1 inherits the entire existing stack** (audit §4) — queue, replay engine, RQ persistence, manual caches, connectivity probe all run in the WebView unchanged (IndexedDB + localStorage are available and app-owned in both WebViews).

Per-platform shell/cold-start behavior:

| | Android shell | iOS shell |
|---|---|---|
| Service worker (`sw.js`) | ✅ Android System WebView supports SW for https origins → precache + offline cold start **work as today** | ⚠️ WKWebView requires **`WKAppBoundDomains`** (Info.plist, ≤10 domains) for SW — **Phase-1 spike** |
| Offline cold start | ✅ | Spike-dependent |
| Offline warm data (RQ cache, manual caches) | ✅ | ✅ (localStorage works regardless of SW) |
| Offline queued writes | ✅ | ✅ (queue is IndexedDB, SW-independent) |

**The iOS spike (Phase 1, go/no-go):** add the app domain to `WKAppBoundDomains`, verify (a) `sw.js` registers and serves the shell offline, (b) the Capacitor bridge still injects and plugins respond (App-Bound Domains restricts script injection to bound domains — the app domain is bound, so this should hold, but the pair is unproven). **Fallback if it fails:** ship iOS without SW — cold start requires connectivity (parity with opening any website), warm data still renders offline, and the Safari PWA remains the offline-capable iOS option until **Stage 2 bundling guarantees offline cold start definitively** (HTML/JS on disk).

## 3. Synchronization & conflict handling

- **No new sync engine.** The IndexedDB queue + FIFO replay is the only mutation-replay path, native included (recurrence-safety doctrine: never a second engine for an existing concept).
- Semantics stay: update-dedup, create+delete cancellation, tempId→realId swap, 4xx-drop / 5xx-retry(≤5) / network-stop.
- **Conflicts remain last-write-wins** — documented, deliberate. A 2-user household has a low concurrent-edit rate; recycle bin provides recovery; hub realtime reduces staleness windows.
- **Optional hardening (separate phase, money-rules skill mandatory):** add an `updated_at` precondition to money-mutating PATCH routes (transactions, transfers, accounts): client echoes the `updated_at` it loaded; server compares and returns **409** on mismatch; client refetches and prompts. Additive and backward-compatible (absent field ⇒ current behavior). Do **not** build version columns/CRDTs — over-engineering at this scale.
- Native app increases *offline windows* (phones offline more than laptops), which raises replay-overwrite odds slightly — the reason the hardening option is documented now rather than discovered later.

## 4. Native notification strategy

### 4.1 Transport split

| Client | Transport | Status |
|---|---|---|
| Browsers (laptop/tablet/PWA) | web-push + VAPID → `sw.js` | **Untouched** |
| Android + iOS shells | **FCM HTTP v1** (one Firebase project; iOS delivered via APNs — upload the APNs `.p8` key to Firebase once) | New branch |

**Server implementation:** no `firebase-admin`. Mint OAuth tokens with the **already-present `googleapis`** dependency (its bundled google-auth-library + a service account) and POST to `https://fcm.googleapis.com/v1/projects/<id>/messages:send` with fetch. ~150 lines in `src/lib/pushSender.ts`. New server env vars: `FIREBASE_SERVICE_ACCOUNT_JSON` (secret), `FIREBASE_PROJECT_ID` — set on **both** Vercel projects (cron sends run on `era-web`; user-triggered sends, e.g. hub messages and test pushes, run on whichever deployment served the request). Sends target the FCM API directly, so which deployment executes them is irrelevant to delivery.

**Cron rule (deployment topology):** the external scheduler keeps targeting **only the web deployment** — the mobile deployment's cron routes must never be scheduled, or every notification/auto-post fires twice (doc 2, topology table).

### 4.2 DB migration spec (`push_subscriptions`)

```sql
-- migrations/YYYY-MM-DD_native_push.sql
ALTER TABLE public.push_subscriptions
  ADD COLUMN platform text NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web','fcm')),
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth   DROP NOT NULL;
-- FCM rows: the device token is stored in `endpoint` (p256dh/auth NULL)
```

**Why token-in-endpoint:** reuses the entire existing lifecycle with zero further changes — endpoint-keyed dedup in the subscribe route, `is_active`/`failed_at` deactivation in the sender, health checks, per-`device_id` rows. FCM's `UNREGISTERED`/`INVALID_ARGUMENT` errors map onto the existing 410/404 deactivation path. Backward-compatible: all existing rows default to `platform='web'`.

Subscribe route (`src/app/api/notifications/subscribe/route.ts`): Zod **discriminated union** on `platform` — `web` variant requires `p256dh`/`auth` (today's shape); `fcm` variant requires only the token + device fields.

Client seam (`src/hooks/usePushNotifications.ts`): at the single point where it calls `pushManager.subscribe`, branch on `isNative()` → `PushNotifications.requestPermissions()` + `register()` → `registration` event supplies the token → POST the same subscribe endpoint with `platform:'fcm'`. All the existing hardening (device-id, resubscribe-on-rotation via the plugin's token-refresh event, health sync) is reused around it.

### 4.3 Payload contract (preserved from `sw.js`)

FCM v1 **hybrid messages** (notification block for OS rendering in background + data block for the app):

```jsonc
{
  "message": {
    "token": "<endpoint>",
    "notification": { "title": "...", "body": "..." },
    "data": { "type": "item_reminder", "notification_id": "...", "action_url": "/expense?tab=reminder&item=..." },
    "android": {
      "priority": "HIGH",
      "collapse_key": "<tag>",                    // mirrors current sw.js tag
      "notification": { "channel_id": "<per-type channel>" }
    },
    "apns": {
      "headers": { "apns-collapse-id": "<tag>", "apns-priority": "10" },
      "payload": { "aps": { "interruption-level": "time-sensitive", "sound": "default", "thread-id": "<tag>" } }
    }
  }
}
```

`data.type` → channel/priority mapping lives next to the existing `data.type` table in `pushSender.ts`, so web and native payloads are built from one source of truth. Tap → app opens with the data → `DeepLinkHandler` routes via the **existing** `action_url` contract (TabContext `pendingItemId`/`pendingThreadId` unchanged).

### 4.4 Android: channels, DND override, full-screen, exact alarms

| Capability | Mechanism | User grant required |
|---|---|---|
| High-priority heads-up | Per-type **notification channels** created at app start (item alarms = high importance + sound + vibration; chat = default; summaries = low) | Notification permission (Android 13+) |
| **DND override** | Channel-level "Override Do Not Disturb" — app deep-links the user to the channel settings screen to flip it | Yes, per channel — guided by the **permissions onboarding screen** |
| **Full-screen alarm** | Full-screen intent for alarm-class types; Android 14+ restricts `USE_FULL_SCREEN_INTENT` to user-granted apps | Yes — onboarding deep-links to the grant screen |
| **Exact alarms** | `@capacitor/local-notifications` with `SCHEDULE_EXACT_ALARM` | Yes on Android 14+ |
| Doze delivery | `"priority": "HIGH"` FCM messages for alarm-class types (exempt from Doze throttling) | — |

### 4.5 iOS: interruption levels, critical alerts — honest ceiling

- **Time Sensitive** (`interruption-level: time-sensitive`): standard entitlement toggle, no Apple approval; breaks through Focus/DND **if the user allows the app's Time Sensitive notifications** — this is the *planned* ceiling and covers item alarms + bill-due.
- **Critical Alerts** (bypass mute switch + DND unconditionally): requires a per-app entitlement application to Apple; approval odds for a personal budget app are **low** (granted for health/safety/home-security categories). Plan: apply once (free, 10-minute form), treat approval as a bonus — **nothing in the design depends on it**.
- No legal blockers in either store for these mechanisms; both are user-consent-gated by design.

### 4.6 Local-notification "alarm mirror" (Phase 4)

Redundancy layer for delivery-critical item alarms: while the app runs, schedule the next-N upcoming `item_alerts` as **exact local notifications**; cancel/re-sync on alert changes and on push receipt (dedupe by alert id via collapse/tag). Server cron + push stays the **source of truth**; the mirror covers offline phones and FCM hiccups. Consciously scoped small — no client-side recurrence expansion (recurrence-safety: the server already expands occurrences).

### 4.7 Accepted v1 degradation — action buttons

`sw.js` action buttons (complete/snooze from the notification, calling APIs without opening the app) **don't exist on native FCM taps in v1** — background-rendered notifications carry no JS handlers. v1 = tap-through deep link (contract preserved). Parity is a Phase-4+ enhancement: iOS notification categories / Android action receivers, or local-notification re-emission. The current buttons keep working for browser/PWA users throughout.

## 5. Geolocation & background permissions

**No location code exists today (audit §6) — this is a new capability, not a port.**

- **Phase 5, foreground-only start:** `@capacitor/geolocation`, "While Using" (iOS) / foreground (Android). First consumers: location-stamped expenses; presence for the backlog "Location & Presence Mesh" (#18).
- **Background/geofencing: deferred.** Needs a specialized plugin (Transistorsoft background-geolocation, ~$349 one-time license, or community alternatives), an Apple "Always" justification, and real battery cost. Decide only when a concrete feature demands it.
- **Background sync/tasks:** `@capacitor/background-runner` optional in Phase 5. Honest expectations: iOS background refresh is opportunistic (~15 min+, no guarantee); Android WorkManager is reliable-ish. **The server cron + push architecture already provides proactivity** — background client work is a nice-to-have, not a pillar.
- **Permissions lifecycle:** request-on-first-use through the bridge; never batch-request at launch. Manifest additions enumerated at implementation: Android `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_FULL_SCREEN_INTENT`, (`ACCESS_FINE_LOCATION` Phase 5, `NFC` Phase 4); iOS Info.plist `NSMicrophoneUsageDescription` (voice mode), `NSCameraUsageDescription` (receipts), (`NSLocationWhenInUseUsageDescription` Phase 5, NFC entitlement Phase 4).

## 6. Native NFC (Phase 4)

Today: tag URL → browser → `era_nfc_redirect` cookie → manual PWA open (5 steps). Native:

- **Android:** App Links intent filter → tag tap opens the app directly at `/nfc/<slug>` (authed WebView) — 2 steps, no plugin needed for URL tags.
- **iOS:** Universal Links + background tag reading → same. `@capgo/capacitor-nfc` added only if in-app **reading/writing** of tags becomes wanted (admin currently uses external writer apps).
- **Both domains are associated** (`applinks:`/intent-filters for the web domain AND the mobile domain): physical tags already encode web-domain URLs and keep working — a tap opens the native app even though the shell runs on the mobile deployment. The `.well-known` files live in `public/` and are therefore served identically by both Vercel projects automatically (inert to browsers — fetched by OSes, not pages).
- The cookie bridge stays as the web fallback; `DeepLinkHandler` gains the `appUrlOpen` path (route whitelist enforced — see §8).

## 7. Bridge module design — `src/lib/native/`

The **only** place allowed to import `@capacitor/*` (house rule for CLAUDE.md at implementation).

```
src/lib/native/
├─ index.ts          # isNative(), getPlatform() — safe on web (checks window.Capacitor)
├─ push.ts           # registerNativePush(): permissions → register → token → subscribe POST
├─ deeplinks.ts      # initDeepLinks(router): App.addListener('appUrlOpen', whitelist-routed)
├─ haptics.ts        # installVibrateShim(): iOS maps navigator.vibrate → Haptics (30 call sites untouched)
├─ notifications.ts  # channel creation, permission onboarding helpers, alarm-mirror (Phase 4)
├─ nfc.ts            # Phase 4 (only if in-app read/write wanted)
└─ geo.ts            # Phase 5
```

Rules: dynamic `import()` of plugins (web bundle stays clean); every function no-ops on web; unit-tested in web no-op mode with vitest. Initialization: one `<NativeBridge />` client component mounted in `layout.tsx` beside `ServiceWorkerRegistration`, gated on `isNative()`.

## 8. Security considerations

| Concern | Handling |
|---|---|
| Firebase service account | Server-only Vercel env var; never in client bundle or shells |
| Supabase anon key | Already public by design; RLS remains the enforcement boundary (unchanged) |
| WebView hardening | `allowNavigation` = app domain only; external links open the system browser via the bridge; CSP kept as-is (bridge injection is native-side; **note:** if CSP ever moves to nonce-based, re-test the shells) |
| Deep-link injection | `appUrlOpen` routes only whitelisted internal paths (`/nfc/*`, `/expense*`, `/chat*`, …) — never raw `window.location` from external input |
| FCM tokens | Stored in `push_subscriptions` under existing RLS, same sensitivity class as web push endpoints today |
| Key custody | Android upload keystore + Apple certificates in the password manager; Play App Signing escrows the release key (doc 4) |
| Shell contents | Stage-1 shells contain **no secrets at all** (remote content) |
| Two-project env parity | `era-mobile` carries the full `era-web` secret set (same Supabase/Gemini/Azure/VAPID/Firebase) except `NEXT_PUBLIC_APP_URL`; parity check is part of the Phase-0 checklist and any later env change must be applied to both — drift shows up as native-only bugs |
| Screenshots/recents | PrivacyBlur context already exists in-app; optional later: `FLAG_SECURE` (Android) via a 5-line plugin call |

## 9. Library/plugin/service inventory

| Package | Phase | Purpose |
|---|---|---|
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` (v7) | 1 | Shell + bridge |
| `@capacitor/app` | 1 | Deep links (`appUrlOpen`), lifecycle |
| `@capacitor/status-bar` | 1 | Status-bar theming per app theme |
| `@capacitor/push-notifications` | 2 | FCM/APNs registration + tap events |
| `@capacitor/local-notifications` | 4 | Exact-alarm mirror |
| `@capacitor/haptics` | 4 | iOS vibrate shim |
| `@capgo/capacitor-nfc` | 4 (conditional) | In-app NFC read/write, only if wanted |
| `@capacitor/geolocation` | 5 | Foreground location |
| `@capacitor/background-runner` | 5 (optional) | Background tasks |
| `@capacitor/assets` | 1 (dev) | Icon/splash generation |

Services: **Firebase** (FCM only, free tier, no other Firebase products), **Play Console**, **App Store Connect**; existing Vercel/Supabase/Azure unchanged. Explicitly not adopted: `firebase-admin` (googleapis suffices), OneSignal, Appflow (sunset), Capgo (deferred by decision — revisit at Unlisted graduation).

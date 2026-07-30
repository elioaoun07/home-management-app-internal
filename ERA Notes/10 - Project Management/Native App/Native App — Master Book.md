---
created: 2026-07-11
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Current State Audit, 2 - Architecture Decision, 3 - Platform Integration Spec, 4 - Distribution & Operations, 5 - Roadmap & Phases, 6 - Risks & Limitations (originals in ../_Archive/Native App/)"
tags:
  - pm/master-book
  - scope/app
  - module/native
---

# Native App — Master Book

> **Stamped:** 2026-07-11 · **Status:** 📋 PLANNED — approved plan, implementation not started.
> **No checklist yet.** This campaign has no `4 - Checklist.md` and no ID prefix registered in [_Conventions](<../_Conventions.md>) §5. When work actually starts, register a `NAT` prefix, add the campaign to `CAMPAIGNS` in `scripts/pm/lint.mjs`, and create the checklist from `_Templates/Campaign Checklist.md`.
>
> **Freshness protocol:** trust this plan as of 2026-07-11. Before implementing any phase, delta with `git log --since=2026-07-11 -- src/lib/pushSender.ts src/hooks/usePushNotifications.ts src/lib/supabase/ proxy.ts next.config.ts public/sw.js` — those are the load-bearing integration points. If `push_subscriptions` changed, re-verify the migration spec.

## Identity & North Star

**Owner intent:** Elio on Android, partner on iPhone, web stays first-class for laptop and tablet.

Evolve the existing PWA into native Android + iOS apps with a **two-stage Capacitor architecture on the existing codebase**. Stage 1 ships a Capacitor 7 *remote shell* whose WebView loads a **dedicated `era-mobile` Vercel deployment** (same repo and branch, own domain, env parity), so the existing web/PWA deployment is never touched, redeployed for native reasons, or referenced by the binaries — plus native push (FCM/APNs), deep links and native device plugins. Zero frontend fork; every push updates both phones automatically with independent rollback. Stage 2 (deferred, only when graduating iOS to the Unlisted App Store) bundles a static export into the shell to pass full App Review.

Distribution: **Play Internal Testing** (Android, immediate, auto-updates) and **TestFlight internal** (iOS, zero App Review ever, 90-day rebuild ritual) — **no store-review gate anywhere** until the optional Unlisted graduation.

> **Hard constraint (owner, 2026-07-11): the PWA must never be interrupted or impacted by the native solution.** Enforced at two layers: the isolated `era-mobile` deployment (infrastructure) and the **PWA Non-Interference Contract** (code/DB invariants). Contract breach = STOP condition.

This activates the standing parked decision ("Capacitor shell — revisit when triggered"); the trigger fired 2026-07-11 by explicit request.

## Current State (verified 2026-07-11)

**Framework:** Next.js 16.0.7, React 19.1.0, TypeScript ^5, pnpm, Turbopack. No PWA plugin — `public/sw.js` (v5.3.0, ~1,400 lines) is hand-written. Deployed on Vercel with no committed config; **the cron schedule lives outside the repo** (6 routes triggered by an external scheduler with `Bearer CRON_SECRET`). Node engine is unpinned.

**Why the frontend is NOT statically exportable today** — the hard blockers to `output: "export"`, which is exactly why Stage 1 uses a remote shell and what Stage 2 must refactor:

1. Active middleware — root `proxy.ts` refreshes the Supabase session cookie on every matched request.
2. Server-gated RSC pages read cookies via `supabaseServerRSC()` and `redirect("/login")`; several use `dynamic = "force-dynamic"`.
3. One server action — `src/app/login/actions.ts`.
4. **186 API route handlers** in 49 groups — the backend *is* this app.
5. `next/image` with the default loader, but in only **1 file** — trivially fixable.
6. No `generateStaticParams` anywhere.

**Auth:** cookie-session only via `@supabase/ssr`, email + password only. API routes authenticate through the **single helper** `src/lib/supabase/server.ts` (293 occurrences across 166 route files) — that single choke point is what makes a Stage-2 bearer fallback cheap. **No user-facing bearer-token path exists today.**

**Push pipeline (the contract Stage 1 must preserve):** `cron/API → pushSender.ts::sendPushToUser()` (single send choke point) → web-push VAPID → `sw.js` push handler → `notificationclick` → NAVIGATE → `DeepLinkHandler` → `TabContext`. The payload contract `{title, body, icon, badge, tag, data: {type, notification_id, action_url}}` — where `data.type` (~15 values) selects actions, vibration and deep-link — **is the native integration surface**. `push_subscriptions` has `endpoint`/`p256dh`/`auth` all NOT NULL, one row per `device_id`.

**Offline stack (Stage 1 inherits unchanged):** IndexedDB op queue (`offlineQueue.ts`, max 200 ops, update-dedup, create+delete cancellation) → FIFO replay (`offlineSyncEngine.ts`, 2xx remove / 4xx drop / 5xx retry ×5, auth refresh first, tempId→realId swap) → TanStack persister to localStorage (whitelist only) → `connectivityManager` probing `HEAD /api/health` → `safeFetch` guard → SW precache + inline loading shell. **Offline writes exist for exactly 5 features** (transactions, items, subtasks, recurring-confirm, hub messages). **Conflict handling is last-write-wins** — no version columns, no If-Match.

**Realtime:** hub chat/shopping on Supabase broadcast channels (deliberately not `postgres_changes`), notifications bell on `postgres_changes`. Both run on the browser-client singleton → identical inside a WebView.

**Device API inventory:** Web Push ✅ (must be replaced by FCM/APNs in shells — `pushManager` doesn't exist in WebViews) · `navigator.vibrate` ✅ ~30 files (works on Android WebView, **no-op in WKWebView** → haptics bridge) · getUserMedia + Azure Speech ✅ (works in WKWebView ≥ iOS 14.3 with `NSMicrophoneUsageDescription`) · camera ✅ · geolocation ❌ (new capability, not a port) · Web NFC ❌ (tags carry URLs today via the `era_nfc_redirect` cookie bridge; native NFC + Universal Links replace it).

**PWA surface:** root `public/manifest.json` + **9 per-route manifests** forming a multi-PWA setup, untouched by this plan. Safe-area is already handled (`viewport-fit` / `env(safe-area-inset-*)`) — the UI is notch-ready.

## Pain Inventory

- 🟠 The **`WKAppBoundDomains` × `server.url`** pairing is unproven — service-worker offline cold start and bridge injection have never been verified together on a real iPhone. This is the Phase-1 go/no-go spike.
- 🟠 **Env drift between `era-web` and `era-mobile`** is the standing human-factor risk — a missing secret on one project shows up as confusing native-only bugs.
- 🟠 **A shared code or DB change can still break the PWA despite deployment isolation.** The deployment split does not cover this by design; the Non-Interference Contract, the additive-migration rule and a per-phase web-regression gate carry it.
- 🟡 **Cron misconfiguration would double-execute** — if the external scheduler ever targets `era-mobile`, duplicate notifications and duplicate auto-posts follow (a recurrence-safety violation). One execution serves all clients because both deployments share one DB.
- 🟡 **The TestFlight 90-day expiry** will eventually be missed — the partner's app stops launching until a ~30-minute re-upload.
- 🟡 Play's yearly target-API ratchet forces a rebuild roughly once a year.
- ⚪ Last-write-wins conflicts stand; documented, not hardened, until evidence demands it.
- ⚪ Notification action buttons are not available in v1 on either platform (tap-through only).

## Shipped Log

*(Nothing implemented. Phase 0 has not started.)*

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Decisions locked (2026-07-11)

| Decision | Choice |
|---|---|
| iOS build machine | owns a Mac → local Xcode; cloud CI optional later |
| iOS channel | TestFlight internal first → Unlisted App Store later if the 90-day treadmill annoys |
| Android channel | Play Internal Testing |
| Architecture | two-stage Capacitor 7 on the existing codebase |
| Deployment topology | a dedicated `era-mobile` Vercel project (same repo/branch), web project untouched |
| Push transport | FCM HTTP v1 for both shells (iOS via APNs; upload the `.p8` key to Firebase once); browsers keep web-push + VAPID **untouched** |
| OTA layer | none — store-track auto-update is enough at 2 devices |

**Costs:** Apple Developer Program $99/yr (the only recurring cost) · Play Console $25 once · Firebase (FCM only) free · second Vercel project $0 · Capgo/OneSignal/Appflow $0, not adopted.

### Why Stage 1 is a remote shell

The app is server-dependent, so bundling the frontend is a multi-day refactor while the remote shell is a near-zero frontend fork. Every web deploy updates both phones instantly — stronger than the stated requirement. All 30+ modules keep working by construction. Native wins (reliable push with DND/full-screen, exact alarms, NFC auto-open, stable storage) come from the plugin layer, not from rewriting UI.

**Tradeoffs accepted:** WebView rendering (the UI is already a mobile-first PWA tuned on these exact phones) · App Review compatibility deferred to Stage 2 (irrelevant on the chosen zero-review tracks) · iOS offline cold start needs the spike · a mobile-deployment outage means a native outage (identical to today's PWA exposure, and the phones can fall back to the untouched web PWA).

**Stage 2 scope (bounded, ~4–6 days, only if the Unlisted graduation happens):** bearer-token fallback in `src/lib/supabase/server.ts` · CORS for the native origin in `proxy.ts` · client-side auth gates replacing RSC `redirect()` for the exported tree · `next/image` → `unoptimized` (1 file) · iOS privacy manifests + App Store assets.

### Platform integration highlights

- **Auth on Stage 1** is the identical cookie session inside the WebView against the mobile deployment's origin — `sb-*` cookies are first-party there and persist in app-owned storage (`WKWebsiteDataStore` on iOS), **not** subject to Safari ITP eviction, so it should be *more* stable than the current iOS PWA. Web and mobile are independent sessions: one extra login at onboarding, then permanent. Config only: add the mobile domain to Supabase Auth's redirect allow-list.
- **Android notification capabilities:** per-type channels created at app start (item alarms = high importance + sound + vibration; chat = default; summaries = low) · DND override at channel level (app deep-links the user to the channel settings screen) · full-screen intent for alarm-class types (Android 14+ requires a user grant) · exact alarms via `SCHEDULE_EXACT_ALARM` · `priority: HIGH` FCM for alarm classes to survive Doze.
- **iOS ceiling is honest:** Time Sensitive is the planned ceiling; Critical Alerts entitlement is expected to be denied and the design never depends on it. No full-screen alarm concept exists — banner + sound is the ceiling.
- **Security:** Firebase service account is server-only · `allowNavigation` limited to the app domain, external links open the system browser via the bridge · `appUrlOpen` routes only whitelisted internal paths, never raw `window.location` from external input · Stage-1 shells contain **no secrets at all** · if CSP ever moves to nonce-based, re-test the shells.
- **The bridge module `src/lib/native/` is the only `@capacitor/*` import surface** in the codebase.

### Phase roadmap

| Phase | Scope | Effort | Exit criterion |
|---|---|---|---|
| 0 | Accounts & groundwork: Apple, Play, Firebase, the `era-mobile` project with env parity, settle the **mobile domain** (changing it later means rebuilding both binaries), Supabase redirect allow-list, **pin the external cron schedule into the vault with the web-only rule**, pin Node `engines` | S · 0.5–1 d + waits | both store accounts verified, Firebase exists, `era-mobile` deployed with parity, mobile domain final, cron schedule + web-only rule documented |
| 1 | Capacitor shell MVP: `capacitor.config.ts` with `server.url`, generate and commit `android/` + `ios/`, icons/splash/status-bar, `src/lib/native/` skeleton, SW platform guards, **the iOS `WKAppBoundDomains` spike on a real iPhone**, sanity pass on both physical phones | M · 2–3 d | the app runs on both phones with login and core flows; spike verdict written down |
| 2 | Native push end-to-end: `native_push.sql` migration (platform column, nullable p256dh/auth), Zod discriminated union on the subscribe route, `pushSender.ts` FCM v1 branch with a `data.type` → channel/priority/interruption mapping table, native branch in `usePushNotifications.ts`, Android channels + iOS Time Sensitive/APNs, tap-through deep links, extend the test endpoint | M/L · 3–4 d | a cron-fired push lands on **both locked phones** with correct sound/priority and deep-links correctly; browser web-push verified unregressed |
| 3 | Distribution live: Play internal + TestFlight internal, partner onboarded, auto-update proven with a trivial binary bump, Play data-safety form | M · 1–2 d | both phones run store-track builds that auto-update; partner onboarded without dev involvement |
| 4 | Native wave 1: App/Universal Links, native NFC, haptics shim, local-notification alarm mirror, permissions onboarding | M/L · 3–5 d | — |
| 5 | Native wave 2 (optional): geolocation, background runner, widgets | L · open | — |
| 6 | Unlisted graduation: Stage-2 bundled build + review hardening | L · 4–6 d, deferred | — |

**To "both phones native with push" (Phases 0–3): ~7–10 dev days** across 2–3 weeks of account-verification waits.

### Platform limitation matrix (what native does NOT get us)

| Capability | Android shell | iOS shell |
|---|---|---|
| Notification action buttons (background) | ❌ v1 (tap-through only) | ❌ v1 |
| DND override | ✅ per-channel, user-granted | ⚠️ Time Sensitive only; Critical unlikely |
| Full-screen alarm UI | ✅ user-granted (Android 14+) | ❌ not a platform concept |
| Exact-time local alarms | ✅ `SCHEDULE_EXACT_ALARM` | ⚠️ exact-ish; no true alarm API |
| Guaranteed background sync | ⚠️ WorkManager | ❌ opportunistic BGAppRefresh only |
| Web push in WebView | ❌ (FCM replaces it) | ❌ |
| `navigator.vibrate` | ✅ | ❌ no-op → Haptics shim |
| Service worker in WebView | ✅ | ⚠️ `WKAppBoundDomains` required |
| Wake word / always-listening | ❌ out of scope | ❌ same, stricter |

### Consciously accepted tradeoffs

0. **Two production deployments over one** — buys independent rollback and an untouched web project at the cost of an env-parity ritual and a cron-targeting rule. Deployment isolation covers infrastructure only; code/DB non-interference is contractual, not topological.
1. **Zero-review distribution over permanence** — internal tracks now; the permanent Unlisted link is a bounded later chunk.
2. **Remote shell over bundled** — instant updates and zero duplication now; the offline-cold-start guarantee and review-readiness deferred.
3. **Tap-through notifications in v1** — action-button parity traded for shipping push weeks earlier; browser users lose nothing.
4. **LWW conflicts stand** — hardening documented, not built, until evidence demands it.
5. **No OTA layer** — Capgo re-enters only at Phase 6.

### Spike log

| Date | Spike | Verdict |
|---|---|---|
| — | `WKAppBoundDomains` + `server.url` (SW offline + bridge injection, real iPhone) | *pending — Phase 1* |

## Pointers

- Conventions: [_Conventions](<../_Conventions.md>) — register a `NAT` prefix here before creating a checklist
- Related: `docs/WEAR_OS_NATIVE_APP_IMPLEMENTATION.md` (its pairing-auth pattern is the reference for Stage-2 bearer auth) · [Sync & Offline](<../../03 - Junction Modules/Sync & Offline/>) (the offline stack Stage 1 inherits) · [ERA Awakening — Master Execution Plan](<../ERA Awakening — Master Execution Plan (2026-07-06).md>) (wake-word and voice items gated on this shell; Phase 5 unlocks re-evaluation)
- Pre-consolidation originals (the six-doc plan pack, including the full distribution runbooks and the complete risk register): `../_Archive/Native App/`

# 6 — Risks & Limitations

**Stamped:** 2026-07-11 · Covers plan section 16: risks, platform limitations, tradeoffs — each with likelihood, impact, and the planned mitigation. The Phase-1 spike verdict must be appended here when it lands.

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **WKAppBoundDomains × `server.url`** — SW offline and bridge injection unproven as a pair on iOS | Medium | iOS loses offline **cold start** (warm data + queued writes still work) | Phase-1 spike on real iPhone; fallback = online-required iOS cold start, Safari PWA stays the offline option, Stage 2 solves definitively |
| 2 | **iOS Critical Alerts entitlement denied** | High (expected) | None — design never depends on it | Time Sensitive is the planned ceiling; Critical is a free bonus application |
| 3 | **FCM delivery throttling in Doze/App Standby (Android)** | Medium for normal-priority | Alarm-class notifications late | `priority: HIGH` for alarm types; Phase-4 local alarm mirror as redundancy |
| 4 | **TestFlight 90-day expiry missed** → partner's app stops launching | Medium (human factor) | Partner outage until re-upload (~30 min fix) | Calendar reminder every 80 days; later a scheduled GH Actions macOS workflow; ultimate fix = Phase 6 Unlisted |
| 5 | **Play yearly target-API ratchet** | Certain (~1×/yr) | Forced rebuild or update-block on the internal track | Calendar reminder; Capacitor's annual majors usually bundle the bump |
| 6 | **Mobile-domain change after launch** | Low (owner-controlled) | Both binaries rebuilt (server.url, AASA, assetlinks, FCM links pin the **mobile** deployment's domain; the web domain is unconstrained) | Phase 0 settles the mobile domain **before** any binary ships |
| 7 | **Mobile-deployment outage ⇒ native outage (Stage 1)** | Same class as today's PWA exposure | Both phones degraded (offline caches still serve reads); **web PWA unaffected** (separate project) — and phones fall back to it | Accepted; independent rollback/pinning on `era-mobile`; Stage 2 bundling removes it |
| 8 | **Capacitor major upgrades** | 1–2×/yr | ~1h each; occasional plugin API churn | Pin versions; upgrade deliberately, not automatically |
| 9 | **CSP tightened to nonces later** | Low | Bridge injection could need re-testing | Note lives here + in `next.config.ts` review checklist: re-test shells after CSP changes |
| 10 | **App Review rejection at Unlisted graduation (guideline 4.2)** | Low *with* Stage-2 bundling; high without | Unlisted path blocked (internal tracks unaffected) | Never submit the remote shell for review; Stage 2 is a hard prerequisite of Phase 6 |
| 11 | **WKWebView cookie/session eviction** | Low | Partner re-login | `WKWebsiteDataStore` is app-owned (no Safari ITP 7-day cap) — expected *more* stable than the current iOS PWA; monitor during Phase 1–3 |
| 12 | **Offline replay overwrites (LWW) as phone offline-windows grow** | Low (2 users) | Rare lost edit; recycle bin recovers | Documented in doc 3 §3; optional `updated_at` 409-guard on money PATCHes if it ever bites |
| 13 | **Env drift between `era-web` and `era-mobile`** | Medium (human factor) | Confusing native-only bugs (missing secret on one project) | Parity rule + env-change ritual (doc 4 §3); Phase-0 parity checklist |
| 14 | **Cron scheduler pointed at `era-mobile` (misconfig)** | Low | **Double execution** — duplicate notifications, duplicate auto-posts (recurrence-safety violation) | Hard rule in the topology table (doc 2) + written into the Phase-0 cron schedule doc; both deployments share one DB so one execution serves all clients |
| 15 | **Shared code/DB change breaks the PWA despite deployment isolation** | The real residual risk | PWA regression — the prohibited outcome | The deployment split does not cover this by design; the **PWA Non-Interference Contract** (doc 2) + additive-migration rule + per-phase web-regression gate carry it; contract breach = STOP condition |

## Platform limitation matrix (what native does NOT get us)

| Capability | Android shell | iOS shell |
|---|---|---|
| Notification action buttons (background) | ❌ v1 (tap-through only; Phase-4+ enhancement) | ❌ v1 (same) |
| DND override | ✅ per-channel, user-granted | ⚠️ Time Sensitive only (user-permitted); Critical unlikely |
| Full-screen alarm UI | ✅ user-granted (Android 14+) | ❌ not a platform concept (banner + sound is the ceiling) |
| Exact-time local alarms | ✅ `SCHEDULE_EXACT_ALARM` | ⚠️ local notifications are exact-ish; no true alarm API |
| Guaranteed background sync | ⚠️ WorkManager (reliable-ish) | ❌ opportunistic BGAppRefresh only |
| Web push in WebView | ❌ (native FCM replaces it) | ❌ (same) |
| `navigator.vibrate` | ✅ works | ❌ no-op → Haptics shim (Phase 4) |
| Service worker in WebView | ✅ | ⚠️ WKAppBoundDomains required (spike) |
| Wake word / always-listening | ❌ out of scope (ERA Awakening: parked; Phase 5 may re-evaluate) | ❌ same, stricter |

## Consciously accepted tradeoffs (summary)

0. **Two production deployments over one** — the PWA-isolation constraint buys independent rollback/pinning and an untouched web project at the cost of an env-parity ritual and a cron-targeting rule. Deployment isolation covers infrastructure only; code/DB non-interference is contractual (doc 2), not topological.
1. **Zero-review distribution over permanence** — internal tracks now; the permanent Unlisted link is a bounded later chunk, not a prerequisite.
2. **Remote shell over bundled** — instant updates + zero duplication now; offline-cold-start guarantee and review-readiness deferred to Stage 2.
3. **Tap-through notifications v1** — action-button parity traded for shipping push weeks earlier; browser users lose nothing.
4. **LWW conflicts stand** — correctness hardening documented but not built until evidence demands it.
5. **No OTA layer** — store-track auto-update is enough at 2 devices; Capgo re-enters the picture only at Phase 6.

## Spike log

| Date | Spike | Verdict |
|---|---|---|
| — | WKAppBoundDomains + `server.url` (SW offline + bridge injection, real iPhone) | *pending — Phase 1* |

# 5 — Roadmap & Phases

**Stamped:** 2026-07-11 · Covers plan sections: phased roadmap (17), testing strategy (18), complexity estimates (20). Each phase has an explicit exit criterion — do not start a phase before the previous one's criterion is met (start-task protocol applies per phase).

---

## Phase 0 — Accounts & groundwork · **S · 0.5d active + verification waits**

| Step | Note |
|---|---|
| Enroll Apple Developer Program ($99/yr) | Identity verification 1–2 days — start first |
| Register Play Console personal account ($25) | Verification can take days |
| Create Firebase project, enable FCM, generate service account | Free; no other Firebase products |
| **Create the `era-mobile` Vercel project** (same repo, `main` branch) | PWA-isolation topology (doc 2): full env parity with `era-web` except `NEXT_PUBLIC_APP_URL`; web project untouched |
| **Settle the MOBILE domain** | AASA/assetlinks + `server.url` + FCM deep links pin to the **mobile** deployment's domain (subdomain or its `*.vercel.app` URL); changing it later means rebuilding both binaries. The web domain is now unconstrained by the binaries |
| Add the mobile domain to Supabase Auth redirect allow-list | Password-reset flow from the native app |
| **Pin the external cron schedule into the vault** | Closes audit gap §8.1 — document which scheduler calls the 6 cron routes and when, **and the rule that it targets `era-web` only** (never `era-mobile` — double-execution hazard) |
| Pin Node `engines` in `package.json` | Pre-CI hygiene |

**Exit:** both store accounts verified; Firebase project exists; `era-mobile` deployed with env parity; mobile domain final; cron schedule + web-only rule documented.

## Phase 1 — Capacitor shell MVP · **M · 2–3d**

| Step | Note |
|---|---|
| Add Capacitor 7 (`core/cli/android/ios`), `capacitor.config.ts` with `server.url` = **mobile deployment domain**, `allowNavigation` = mobile domain | Doc 2 structure + topology |
| Generate `android/` + `ios/` projects, commit them | House practice: committed |
| Icons/splash via `@capacitor/assets`; `@capacitor/status-bar` theming; verify safe-area on both notches | UI already notch-ready (audit §7) |
| `src/lib/native/` bridge skeleton (`index.ts`, `deeplinks.ts` stub) + `<NativeBridge />` in layout | The only `@capacitor/*` import surface |
| `ServiceWorkerRegistration` platform guards | Keep SW on Android WebView |
| **iOS spike: `WKAppBoundDomains` + `server.url`** — SW offline cold start AND bridge injection both verified on a real iPhone | Go/no-go; fallback documented in doc 3 §2 |
| Sanity pass on both physical phones: login, expense entry, hub chat, voice mode (mic permission strings), camera receipt scan | Full functional parity expected |

**Exit:** app runs on both physical phones with login + core flows working; spike verdict written into doc 6.

## Phase 2 — Native push end-to-end · **M/L · 3–4d (the biggest engineering chunk)**

| Step | Note |
|---|---|
| Migration `native_push.sql` (platform column, nullable p256dh/auth) + `schema.sql` update | Spec in doc 3 §4.2; Hard Rule 24 pairing |
| Subscribe route Zod discriminated union | `web` vs `fcm` variants |
| `pushSender.ts` FCM v1 branch (googleapis OAuth + fetch), `data.type` → channel/priority/interruption mapping table | Single source of truth for web + native payloads |
| `usePushNotifications.ts` native branch (permissions → register → token → same subscribe POST; token-refresh listener) | Reuse existing hardening around the seam |
| Android: notification channels per type; iOS: Time Sensitive entitlement + APNs key upload to Firebase | Doc 3 §4.4–4.5 |
| Tap-through deep links: FCM tap → `appUrlOpen`/launch intent → `DeepLinkHandler` `action_url` path | Existing contract |
| Extend `/api/notifications/test` + NotificationSettings test button to native tokens | Testing backbone |

**Exit:** a cron-fired push lands on **both locked phones** with correct sound/priority and deep-links to the right screen; browser web-push verified unregressed.

## Phase 3 — Distribution live · **M · 1–2d + store processing**

| Step | Note |
|---|---|
| Android: upload keystore, AAB, internal testing release, opt-in on Elio's phone | Doc 4 §1 runbook |
| iOS: archive on the Mac, TestFlight upload, internal group, partner invited + installed | Doc 4 §2 runbook |
| Verify auto-update on both (push a trivial binary bump) | The "no manual reinstall" requirement, proven |
| Data safety form (Play) filled | Honest minimal declaration |

**Exit:** both phones run store-track builds that auto-update; partner fully onboarded without dev involvement.

## Phase 4 — Native capability wave 1 · **M/L · 3–5d**

| Step | Note |
|---|---|
| `public/.well-known/assetlinks.json` + `apple-app-site-association`; App Links / Universal Links verified for **both domains** (web + mobile — served by both projects automatically from `public/`) | NFC tags (web-domain URLs) + notification URLs + reset emails now open the app |
| NFC: tag tap → app directly (cookie bridge retired on native, kept on web) | Doc 3 §6; `@capgo/capacitor-nfc` only if in-app read/write wanted |
| Haptics shim (`navigator.vibrate` → Haptics on iOS) | 30 call sites untouched |
| Local-notification **alarm mirror** for next-N `item_alerts` | Doc 3 §4.6; recurrence-safety reviewed |
| **Permissions onboarding screen**: notification permission, alarm channel DND-override, full-screen intent grant, exact-alarm grant — each with deep-link to the OS settings screen | Doc 3 §4.4; ui-guardrails apply |
| Apply for iOS Critical Alerts entitlement (bonus, non-blocking) | Doc 3 §4.5 |

**Exit:** NFC tap opens the app in ≤2 steps on both platforms; an item alarm fires with DND on (Android channel override granted; iOS Time Sensitive allowed).

## Phase 5 — Native capability wave 2 · **L · optional, backlog-driven**

Geolocation foreground features (location-stamped expenses, presence #18) · `@capacitor/background-runner` experiments · home-screen widgets (real native code — WidgetKit/Glance; treat as its own project) · wake-word re-evaluation per ERA Awakening §parked. **No commitment in this plan** — each item re-enters through the normal backlog → Design Doctrine pipeline.

## Phase 6 — Unlisted App Store graduation · **L · 4–6d, deferred**

Trigger: the 90-day TestFlight ritual annoys, or a permanent no-TestFlight install is wanted. Scope: Stage-2 bundled build (doc 2) + review assets (doc 4 §2) + optional Capgo OTA revisit. Explicitly **not scheduled** — documented so it's a bounded, known chunk instead of a cliff.

---

## Testing strategy (section 18)

| Layer | Approach |
|---|---|
| Web regression | Existing `vitest` + `tsc --noEmit` + manual smoke on desktop — **every phase must leave the web app unregressed** (shared codebase; the PWA Non-Interference Contract in doc 2 defines the invariants this gate checks) |
| Bridge unit tests | `src/lib/native/` tested in web no-op mode (vitest, jsdom): every export safe without Capacitor |
| Device matrix | Elio's Android + partner's iPhone (real hardware only — push, DND, NFC, safe-area don't reproduce in emulators reliably) |
| Push E2E | `/api/notifications/test` route + settings test button, extended to native tokens in Phase 2; test each `data.type` class (alarm, chat, bill) per platform |
| Offline drills | Per-platform checklist: airplane-mode cold start → read cached data → create transaction offline → reconnect → verify replay + tempId swap. Run at Phase 1 (Android), spike (iOS), and after any queue/engine change |
| Permission flows | Fresh-install run-through of the onboarding screen on both platforms (grants are one-shot — test with app reinstalls) |
| Staging | The internal tracks **are** staging: internal-only builds carry zero blast radius by definition |
| Money paths | money-rules skill: any Phase-2+ change touching balances (none planned) requires worked example + test |

## Complexity & effort summary (section 20)

| Phase | Complexity | Effort | Risk concentration |
|---|---|---|---|
| 0 | S | 0.5d + waits | Account verification latency |
| 1 | M | 2–3d | WKAppBoundDomains spike |
| 2 | M/L | 3–4d | FCM payload/channel correctness |
| 3 | M | 1–2d | Store-process friction (first time) |
| 4 | M/L | 3–5d | Android 14+ permission grants UX |
| 5 | L | open | Scope discipline |
| 6 | L | 4–6d | Guideline 4.2 review |

**Total to daily-driver native on both phones (P0–P3): ~7–10 dev days across 2–3 calendar weeks.** P4 adds ~1 week when scheduled.

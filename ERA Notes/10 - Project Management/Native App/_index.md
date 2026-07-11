# Native App — Plan Index

**Stamped:** 2026-07-11 · **Status:** 📋 PLANNED — approved plan, implementation not started
**Owner intent:** Elio = Android phone · partner = iPhone · web stays first-class for laptop/tablet

---

## Verdict in one paragraph

Evolve the existing PWA into native Android + iOS apps with a **two-stage Capacitor architecture on the existing codebase**. Stage 1 ships a Capacitor 7 *remote shell* — the native app's WebView loads a **dedicated `era-mobile` Vercel deployment** (same repo/branch, own domain, env parity), so the existing web/PWA deployment is **never touched, redeployed for native reasons, or referenced by the binaries** — plus native push (FCM/APNs), deep links, and native device plugins. Zero frontend fork; every push updates both phones automatically with independent rollback. Stage 2 (deferred, only when graduating iOS to the Unlisted App Store) bundles a static export of the frontend into the shell to pass full App Review. Distribution: **Play Internal Testing** (Android, immediate, auto-updates) and **TestFlight internal** (iOS, zero App Review ever, 90-day rebuild ritual) — a path with **no store-review gate anywhere** until the optional Unlisted graduation.

> **Hard constraint (owner, 2026-07-11): the PWA must never be interrupted or impacted by the native solution.** Enforced at two layers: the isolated `era-mobile` deployment (infrastructure) + the **PWA Non-Interference Contract** (code/DB invariants) — both in doc 2. Contract breach = STOP condition.

This activates the standing parked decision ("Capacitor shell — revisit when triggered", memory + `3 - Future Vision & Roadmap.md`). The trigger fired 2026-07-11 by explicit request.

## Decisions locked (2026-07-11, with Elio)

| Decision | Choice |
|---|---|
| iOS build machine | Owns a Mac → local Xcode; cloud CI optional later |
| iOS channel | TestFlight internal first → Unlisted App Store later if 90-day treadmill annoys |
| Android channel | Play Internal Testing ($25 one-time) |
| OTA live updates (Capgo) | **Deferred** — store-track auto-updates suffice; revisit at Unlisted graduation |
| PWA isolation (2026-07-11) | **Dedicated `era-mobile` Vercel project** (same repo, `main`, own domain, env parity); shells pin to it; web project untouched; cron targets web only; + code-level Non-Interference Contract (doc 2) |

## Costs

| Item | Cost | Recurring? |
|---|---|---|
| Apple Developer Program | $99/yr | Yes — the only recurring cost |
| Google Play Console | $25 | One-time |
| Firebase (FCM only) | Free | — |
| Second Vercel project (`era-mobile`) | $0 (same account) | — |
| Capgo / OneSignal / Appflow | $0 | Not adopted (deferred / rejected / sunset) |

## Phase overview

| Phase | Scope | Effort |
|---|---|---|
| 0 | Accounts & groundwork (Apple, Play, Firebase, `era-mobile` project + env parity, mobile domain, pin cron schedule) | S · 0.5–1d + waits |
| 1 | Capacitor shell MVP on both phones + iOS offline spike | M · 2–3d |
| 2 | Native push end-to-end (FCM v1, migration, channels, deep links) | M/L · 3–4d |
| 3 | Distribution live (Play internal + TestFlight internal, partner onboarded) | M · 1–2d |
| 4 | Native wave 1: App/Universal Links, native NFC, haptics, alarm mirror, permissions onboarding | M/L · 3–5d |
| 5 | Native wave 2 (optional): geolocation, background runner, widgets | L · open |
| 6 | Unlisted graduation (bundled build + review hardening) | L · 4–6d, deferred |

**To "both phones native with push" (P0–P3): ~7–10 dev days** across 2–3 weeks of account-verification waits.

## Reading order

1. [[1 - Current State Audit]] — what the codebase actually is (evidence-stamped 2026-07-11)
2. [[2 - Architecture Decision]] — the two-stage Capacitor decision, alternatives, rubric
3. [[3 - Platform Integration Spec]] — auth, offline, sync, notifications, geolocation, bridge design, security
4. [[4 - Distribution & Operations]] — Android/iOS runbooks, signing, partner onboarding, rollback
5. [[5 - Roadmap & Phases]] — phase details, exit criteria, testing strategy
6. [[6 - Risks & Limitations]] — platform-limitation table and accepted degradations

## Related artifacts

- Parked spec this plan supersedes: memory `project_capacitor_shell.md` (2026-04-05) + `../3 - Future Vision & Roadmap.md` §Native shell
- `docs/WEAR_OS_NATIVE_APP_IMPLEMENTATION.md` — the Wear OS native brief (separate device class; its pairing-auth pattern is the reference for Stage 2 bearer auth)
- `ERA Notes/03 - Junction Modules/Sync & Offline/` — the offline stack Stage 1 inherits
- `../ERA Awakening — Master Execution Plan (2026-07-06).md` — wake word & voice items gated on this shell (Phase 5 unlocks re-evaluation)

## Freshness protocol

Trust this plan as of 2026-07-11. Before implementing any phase, delta with `git log --since=2026-07-11 -- src/lib/pushSender.ts src/hooks/usePushNotifications.ts src/lib/supabase/ proxy.ts next.config.ts public/sw.js` — those are the load-bearing integration points. If `push_subscriptions` schema changed, re-verify the migration spec in doc 3.

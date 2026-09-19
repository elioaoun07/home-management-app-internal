---
created: 2026-09-10
updated: 2026-09-10
type: master-book
status: active
owner: Elio
---

# Native App — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Reach both phones through store-track shells and verified native delivery. Cross-cutting platform wrapper; modules retain their data/behavior ownership.

## Current state & evidence

The reviewed plan is pending; the Sep6 baseline contains no native implementation. Account groundwork opens Sep15, not Sep10. A shell does not prove permanent login, mic/offline behavior or every module; test the named flows on both devices.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Native App/Native App — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Preserve the PWA Non-Interference Contract: native reasons alone do not change existing web/SW/manifest behavior. Guard native registration and bridge calls by platform.
- Capacitor server.url shell, staged Android then iOS; no assumption that WKAppBoundDomains, remote content, offline cold start and injected bridge work together until the actual iPhone spike passes.
- Native v1 uses the accepted Android channels, iOS Time Sensitive and tap-through policy. Old blanket platform alarm impossibility claims are not current facts; any alternate alarm API remains a later version-specific study.
- Owner supplies platform accounts/signing/distribution and applies reviewed SQL. Store-track update, login/mic/offline and locked-phone push are separate witnesses.
- Scheduler stays with the existing web scheduler of record. NFC enters the existing tag flow after the shell; no geofencing or new tag engine. Extra native features remain conditional on the plan’s measured gates.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🔴 **NAT-1** Prepare native accounts and owner prerequisites. See [acceptance](<#nat-1>) for the root cause, evidence and gate.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### NAT-1

**Outcome:** Prepare native accounts and owner prerequisites.

- **Acceptance:** *(packet **N-00** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>), opens 2026-09-15)* Accounts and groundwork: Apple Developer, Play Console, Firebase project (FCM only), `era-mobile` Vercel project with env parity, final mobile domain, Supabase Auth redirect allow-list. Owner-executed, no code, weeks of verification waits — started early precisely because it has no code in it. §"Phase roadmap" Phase 0

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### NAT-7

**Outcome:** Pin native prerequisites and scheduler ownership.

- **Acceptance:** Pin the supported Node/toolchain setup and document the existing web-only scheduler of record. Native shell setup must not silently move cron ownership or change PWA behavior.

**Provenance:** [Native App — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/Native App — Master Book.md>). The source is historical; this entry owns the retained outcome.

### NAT-2

- **Retained campaign gate (D3):** The PWA Non-Interference Contract holds — no code or DB change made for native reasons has altered the existing web/PWA deployment's behavior.

- **Retained campaign gate (D1):** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.

**Outcome:** Build and verify the Android shell.

- **Acceptance:** *(packet **N-01**)* Capacitor shell MVP — Android: `capacitor.config.ts` with `server.url`, committed `android/`, icons/splash/status bar, a new src/lib/native/ bridge skeleton, SW platform guards. Prereq: manifest inventory recorded (16 files under `public/`, not the Master Book's stated 9).
- **Depends on:** [NAT-1](<Native App — Master Book.md#nat-1>), [NAT-7](<Native App — Master Book.md#nat-7>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### NAT-3

- **Retained campaign gate (D1):** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.

**Outcome:** Verify the iOS shell and WebView constraints.

- **Acceptance:** *(packet **N-02**)* iOS shell + the `WKAppBoundDomains` × `server.url` spike on a real iPhone (SW offline cold start + bridge injection — never verified together).
- **Depends on:** [NAT-2](<Native App — Master Book.md#nat-2>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### NAT-4

- **Retained campaign gate (D2):** A cron-fired push (at the owner-resolved eligible local hour; DEC-01 remains open) lands on both locked phones with correct sound/priority and deep-links to `/era`; the existing browser web-push path is verified unregressed via the test endpoint.

**Outcome:** Deliver native push to both locked phones.

- **Acceptance:** *(packet **N-03**)* Native push end-to-end: `native_push.sql` migration, Zod discriminated union on the subscribe route, `pushSender.ts` FCM v1 branch, Android channels, iOS Time Sensitive, tap-through deep links; browser web-push must stay unregressed. Depends on the proactive briefing (E-05 of the Master Plan) existing as the payload worth shipping this for.
- **Depends on:** [NAT-2](<Native App — Master Book.md#nat-2>), [NAT-3](<Native App — Master Book.md#nat-3>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### NAT-5

- **Retained campaign gate (D1):** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.

**Outcome:** Distribute and verify store-track updates.

- **Acceptance:** *(packet **N-04**, owner-executed)* Distribution: Play Internal Testing + TestFlight internal; partner onboarded; auto-update proven with a trivial binary bump.
- **Depends on:** [NAT-4](<Native App — Master Book.md#nat-4>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### NAT-6

**Outcome:** Add links, NFC and the native haptics bridge.

- **Acceptance:** *(packet **N-05**; plan sacrifice #5 if a gate is missed)* Native wave 1: App/Universal Links, native NFC read into the existing tag flow, haptics shim for iOS.
- **Depends on:** [NAT-5](<Native App — Master Book.md#nat-5>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### NAT-8

- **Retained campaign gate (D3):** The PWA Non-Interference Contract holds — no code or DB change made for native reasons has altered the existing web/PWA deployment's behavior.

**Outcome:** Verify web and native install-scope separation.

- **Acceptance:** Test per-route PWA manifest isolation, independent installed identities and native registration guards on both phones. OUT-18 source change is not a full install witness; no native-motivated alteration of web behavior.
- **Depends on:** [NAT-2](<Native App — Master Book.md#nat-2>).

**Provenance:** [Native App — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/Native App — Master Book.md>). The source is historical; this entry owns the retained outcome.

## Shipped Log



Earlier shipped work is preserved in the linked pre-refactor record; no dated receipt is invented here.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.

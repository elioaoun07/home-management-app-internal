---
created: 2026-09-10
updated: 2026-09-26
type: master-book
status: active
owner: Elio
---

# Native App — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

Item plans follow [the shared execution-plan convention](<../_Conventions.md#9-item-execution-plans>); read only the selected item and its dependencies.

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

- **Reading guide:** Owner-executed; nothing in the repo changes. The only repo-side facts to check before starting are the env surface in `docs/ENV.md` (what a second `era-mobile` Vercel project must reach parity on) and the existing auth redirect usage under `src/app/auth/`. Do not create `capacitor.config.ts`, `android/` or `src/lib/native/` here — that is NAT-2.


**Execution plan — 2026-09-26**

**Readiness:** Owner setup only; no engineering dispatch.

**Verify:** Owner supplies redacted account/project/domain/redirect status; compare variable names with docs/ENV.md without copying secret values. No account or deployment is created by an agent.

```delivery-plan-v1
{
  "outcome": "Prepare the owner prerequisites for the later native shell.",
  "acceptance": [
    "Every prerequisite has an actual status and owner evidence or a named blocker.",
    "No shell implementation is claimed."
  ],
  "scope": [],
  "steps": [
    "Turn the accepted N-00 account/project checklist into a short owner wizard, one dependency group at a time.",
    "Owner verifies Apple Developer, Play Console and Firebase FCM setup with redacted evidence.",
    "Owner selects the final mobile domain and prepares era-mobile environment parity and the Auth redirect allow-list.",
    "Record each pending/ready prerequisite in this item or its existing runbook; hand NAT-2 only the verified status."
  ],
  "invariants": [
    "No credentials enter PM docs.",
    "The existing PWA deployment is unchanged."
  ],
  "exclusions": [
    "Capacitor config, platform projects, purchasing accounts and deployed settings changed by an agent."
  ],
  "checks": [],
  "risks": [],
  "unknowns": [
    "Actual account readiness, final domain and owner platform choices."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. N-00 accepted contract and docs/ENV.md inspected; no external account or deployment evidence queried."
}
```

### NAT-7

**Outcome:** Pin native prerequisites and scheduler ownership.

- **Acceptance:** Pin the supported Node/toolchain setup and document the existing web-only scheduler of record. Native shell setup must not silently move cron ownership or change PWA behavior.

**Provenance:** [Native App — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/Native App — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two bounded contracts: (1) `package.json` currently has no `engines` or `packageManager`; select tested compatible values after verifying the owner build environment, not a guessed latest release. (2) [ERA Top Layer D1](<../Plans/ERA Top Layer.md#accepted-constraints>) selects owner-configured pg_cron/pg_net calling the web deployment. There is no `vercel.json`, but repository absence does not prove the live scheduler configuration. Document accepted ownership and obtain a separate owner liveness/configuration witness. Native setup must not relocate cron or alter the existing PWA.


**Execution plan — 2026-09-26**

**Readiness:** Investigation first; pin tested versions, document ownership.

**Verify:** Verify the chosen clean-install/build toolchain; inspect package metadata and lockfile compatibility. Scheduler owner supplies configuration/last-run evidence; no agent invokes a live cron route.

```delivery-plan-v1
{
  "outcome": "Pin a reproducible native prerequisite toolchain while retaining web scheduling.",
  "acceptance": [
    "A reproducible tested toolchain is recorded.",
    "Scheduler responsibility and missing live evidence are explicit."
  ],
  "scope": [
    "package.json",
    "pnpm-lock.yaml",
    "docs/ENV.md",
    "ERA Notes/10 - Project Management/Native App/Native App — Master Book.md"
  ],
  "steps": [
    "Compare current package/toolchain constraints and owner build environment; verify supported versions in official documentation at execution time.",
    "Pin engines/packageManager to a tested compatible combination; change the lockfile only when the chosen toolchain requires it.",
    "Document the accepted pg_cron/pg_net web scheduler contract separately from its unverified deployment state.",
    "List cron authentication, cadence and liveness evidence without moving scheduling into a native shell."
  ],
  "invariants": [
    "Native setup does not alter PWA behavior or cron ownership."
  ],
  "exclusions": [
    "Selecting a guessed latest version, configuring production cron or building NAT-2."
  ],
  "checks": [],
  "risks": [],
  "unknowns": [
    "Owner build environment and verified deployed scheduler configuration."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. package.json has no engines/packageManager; accepted Top Layer D1 names pg_cron/pg_net, while repo absence of vercel.json does not prove deployment."
}
```

### NAT-2

- **Retained campaign gate (D3):** The PWA Non-Interference Contract holds — no code or DB change made for native reasons has altered the existing web/PWA deployment's behavior.

- **Retained campaign gate (D1):** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.

**Outcome:** Build and verify the Android shell.

- **Acceptance:** *(packet **N-01**)* Capacitor shell MVP — Android: `capacitor.config.ts` with `server.url`, committed `android/`, icons/splash/status bar, a new src/lib/native/ bridge skeleton, SW platform guards. Prereq: manifest inventory recorded (16 files under `public/`, not the Master Book's stated 9).
- **Depends on:** [NAT-1](<Native App — Master Book.md#nat-1>), [NAT-7](<Native App — Master Book.md#nat-7>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Greenfield: `capacitor.config.ts`, `android/` and `src/lib/native/` remain proposed. Actual SW registration callers are `src/components/ServiceWorkerRegistration.tsx` and `src/hooks/usePushNotifications.ts`; inspect/guard those entry points before changing `public/sw.js` handlers. Preserve the existing PWA manifest set: `public/manifest.json`, `public/pm.webmanifest` and 14 files in `public/manifests/` = 16. Per-route manifests use `metadata.manifest` in route `layout.tsx` files. The PWA Non-Interference Contract (D3) covers these existing browser paths.


**Execution plan — 2026-09-26**

**Readiness:** Split first; Android shell after account/toolchain prerequisites.

**Verify:** Build the proposed shell with the pinned toolchain; owner tests login persistence, /era microphone, Hub, offline banner/cold start and a store-track build on Android. Compare existing PWA flows before/after.

```delivery-plan-v1
{
  "outcome": "Wrap the accepted web deployment in an Android shell without changing browser behavior.",
  "acceptance": [
    "Android login, mic, Hub and offline status work in the built shell.",
    "Native-only branches do not alter existing browser behavior."
  ],
  "scope": [
    "capacitor.config.ts",
    "android/",
    "src/lib/native/",
    "public/sw.js",
    "src/components/ServiceWorkerRegistration.tsx",
    "src/hooks/usePushNotifications.ts",
    "package.json",
    "pnpm-lock.yaml"
  ],
  "steps": [
    "Confirm NAT-1/7 receipts and the intended native project location; inventory current manifests, auth redirects and service-worker registration before scaffolding.",
    "Create the proposed Capacitor config/android project and narrow platform bridge against the accepted server URL; keep secrets outside source.",
    "Add icons/splash/status-bar setup; guard actual registration callers where native evidence requires it, then inspect SW handlers/warmup only as needed.",
    "Verify named Android flows and existing PWA behavior; record failed cold-start/bridge assumptions as blockers rather than promising full offline reliability."
  ],
  "invariants": [
    "No native scheduler replaces the web scheduler.",
    "Remote content is not assumed to work offline."
  ],
  "exclusions": [
    "iOS, push transport, NFC or rewriting modules as native screens."
  ],
  "checks": [],
  "risks": [
    "A broad SW guard can break the PWA instead of only the shell."
  ],
  "unknowns": [
    "Verified server domain/project location and tested toolchain from prerequisites."
  ],
  "dependencies": [
    "NAT-1",
    "NAT-7"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted N-01 and manifest/platform seams reviewed; config, android and native bridge paths are proposed in this repo."
}
```

### NAT-3

- **Retained campaign gate (D1):** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.

**Outcome:** Verify the iOS shell and WebView constraints.

- **Acceptance:** *(packet **N-02**)* iOS shell + the `WKAppBoundDomains` × `server.url` spike on a real iPhone (SW offline cold start + bridge injection — never verified together).
- **Depends on:** [NAT-2](<Native App — Master Book.md#nat-2>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The spike is SW cold start × bridge injection under `WKAppBoundDomains` + `server.url`; the combined native behavior remains unverified. Audit the registration callers in `ServiceWorkerRegistration.tsx` and `usePushNotifications.ts`, then `public/sw.js` install/activate/fetch/message handlers. Test the bridge and offline path together on a real iPhone; source inspection only identifies the browser behavior to preserve.


**Execution plan — 2026-09-26**

**Readiness:** Investigation first; actual iPhone spike gates implementation claims.

**Verify:** Owner tests a real iPhone matrix: online login/bridge/mic, offline cold start, navigation/auth redirects and restart under the proposed domain policy. Preserve version/configuration and observed failures.

```delivery-plan-v1
{
  "outcome": "Establish whether the accepted iOS shell can support remote content, offline start and native bridge together.",
  "acceptance": [
    "The combined required capabilities have device evidence.",
    "An unsupported configuration is reported explicitly instead of marked complete."
  ],
  "scope": [
    "ios/",
    "capacitor.config.ts",
    "src/lib/native/",
    "public/sw.js",
    "src/components/ServiceWorkerRegistration.tsx",
    "src/hooks/usePushNotifications.ts"
  ],
  "steps": [
    "Start from NAT-2, audit both SW registration callers and pin actual iOS/WebView/toolchain versions; inspect current official platform guidance at execution time.",
    "Create the proposed minimal iOS shell with the smallest reviewed domain/bridge configuration.",
    "Run the combined WKAppBoundDomains/server.url/offline-start/bridge matrix on a real iPhone; testing each capability alone is insufficient.",
    "Implement only validated guards; if the combined design fails, record the failing condition and return a bounded alternative for owner choice."
  ],
  "invariants": [
    "No weakening of web authentication or broad navigation allowance to force a pass.",
    "PWA non-interference remains binding."
  ],
  "exclusions": [
    "Assuming Android evidence proves iOS or making untested permanent-login claims."
  ],
  "checks": [],
  "risks": [
    "A working online shell can fail bridge injection or offline startup."
  ],
  "unknowns": [
    "Actual iPhone behavior under the selected domain configuration."
  ],
  "dependencies": [
    "NAT-2"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted N-02 spike retained; ios path is proposed and no device/API compatibility was asserted by this plan."
}
```

### NAT-4

- **Retained campaign gate (D2):** A cron-fired push (at the owner-resolved eligible local hour; DEC-01 remains open) lands on both locked phones with correct sound/priority and deep-links to `/era`; the existing browser web-push path is verified unregressed via the test endpoint.

**Outcome:** Deliver native push to both locked phones.

- **Acceptance:** *(packet **N-03**)* Native push end-to-end: `native_push.sql` migration, Zod discriminated union on the subscribe route, `pushSender.ts` FCM v1 branch, Android channels, iOS Time Sensitive, tap-through deep links; browser web-push must stay unregressed. Depends on the proactive briefing (E-05 of the Master Plan) existing as the payload worth shipping this for.
- **Depends on:** [NAT-2](<Native App — Master Book.md#nat-2>), [NAT-3](<Native App — Master Book.md#nat-3>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The whole browser path already exists and is the unregression baseline. Sender: `src/lib/pushSender.ts` — `ensureVapidConfigured()`, `sendPushToUser()`, the `PushResult` shape; an FCM v1 branch goes beside the VAPID one, not instead of it. Routes: `src/app/api/notifications/subscribe/route.ts` (the Zod discriminated union lands here), plus `unsubscribe/`, `subscription-health/` and `push-logs/`. Client: `src/hooks/usePushNotifications.ts` and `src/hooks/useNotifications.ts`. Service worker: `public/sw.js` `push`, `notificationclick`, `notificationclose` and `pushsubscriptionchange` handlers — deep-link tap-through is the `notificationclick` handler. Logging: `src/lib/pushLogger.ts`. The migration must follow Hard Rule #24 (file first, then `schema.sql`, owner runs it).


**Execution plan — 2026-09-26**

**Readiness:** Split first; native transport after shells and notification policy.

**Verify:** Add discriminated subscription/sender fixtures for browser/native, invalid token, retry and unsubscribe. Owner applies SQL, then verifies locked Android/iPhone sound/priority and /era tap-through plus the browser regression.

```delivery-plan-v1
{
  "outcome": "Deliver the accepted briefing through native push while preserving existing browser push.",
  "acceptance": [
    "Native and browser registrations remain distinct and correctly scoped.",
    "Both locked phones show the intended notification and open /era."
  ],
  "scope": [
    "migrations/",
    "migrations/schema.sql",
    "src/app/api/notifications/subscribe/route.ts",
    "src/lib/pushSender.ts",
    "src/lib/pushLogger.ts",
    "src/lib/native/",
    "android/",
    "ios/",
    "tests/"
  ],
  "steps": [
    "Read current subscription schema and NAT-2/3 device receipts; define browser/native identity and recipient policy before writing a paired migration.",
    "First slice: validated registration/unregistration and platform-guarded token lifecycle; owner supplies configuration and manually applies reviewed SQL.",
    "Second slice: add the FCM branch beside VAPID through the existing sender, preserving per-recipient eligibility and truthful transport outcomes.",
    "Configure accepted Android channels/iOS priority behavior and deep links, then obtain actual locked-phone and browser witnesses using an eligible briefing."
  ],
  "invariants": [
    "No quiet-hour/cap bypass for native sends.",
    "A sender success response is not physical delivery evidence."
  ],
  "exclusions": [
    "New scheduling, unapproved alarm escalation or guaranteed delivery claims."
  ],
  "checks": [],
  "risks": [
    "Token rotation and multiple subscriptions can cause stale targets or duplicate visible alerts."
  ],
  "unknowns": [
    "Current platform credentials, manual deployment and locked-device behavior."
  ],
  "dependencies": [
    "NAT-2",
    "NAT-3",
    "HUB-42",
    "NOTIF-19",
    "DEC-01 before briefing activation."
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. N-03 and existing sender/subscription seams reviewed; new native bridge/schema details require the prerequisite contracts."
}
```

### NAT-5

- **Retained campaign gate (D1):** Both phones (Elio's Android, partner's iPhone) run store-track builds with working login, `/era` (mic functional), hub chat, and offline banner.

**Outcome:** Distribute and verify store-track updates.

- **Acceptance:** *(packet **N-04**, owner-executed)* Distribution: Play Internal Testing + TestFlight internal; partner onboarded; auto-update proven with a trivial binary bump.
- **Depends on:** [NAT-4](<Native App — Master Book.md#nat-4>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-executed distribution; no repo change. The only in-repo dependency is that NAT-2/NAT-3 produced buildable shells.


**Execution plan — 2026-09-26**

**Readiness:** Owner distribution only; prepare evidence and handoff.

**Verify:** Owner records internal-track build identities on both phones, login/mic/Hub/offline smoke results, then a trivial binary increment arriving through each platform update path.

```delivery-plan-v1
{
  "outcome": "Distribute working store-track builds and prove subsequent updates reach both phones.",
  "acceptance": [
    "Both phones run identifiable internal-track builds.",
    "A second binary arrives through the intended update mechanism."
  ],
  "scope": [],
  "steps": [
    "Confirm NAT-4 and the shell receipts; prepare a short owner wizard with exact build identity, signing prerequisites and reversible release steps.",
    "Owner uploads to Play Internal Testing and TestFlight internal, invites the household and installs the intended builds.",
    "Owner tests named flows, then publishes a harmless version increment and observes the actual update path on each phone.",
    "Record installation/update evidence, failures and rollback instructions separately from implementation status."
  ],
  "invariants": [
    "Signing credentials never enter PM docs.",
    "A built binary or store upload alone is not installation/update proof."
  ],
  "exclusions": [
    "Agent publication, public-store launch, account purchase or signing-key management."
  ],
  "checks": [],
  "risks": [
    "Different install origins can leave one phone on a stale binary."
  ],
  "unknowns": [
    "Owner account/signing readiness and actual update behavior."
  ],
  "dependencies": [
    "NAT-4"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted owner-executed N-04 retained; no store connection or deployment action performed."
}
```

### NAT-6

**Outcome:** Add links, NFC and the native haptics bridge.

- **Acceptance:** *(packet **N-05**; plan sacrifice #5 if a gate is missed)* Native wave 1: App/Universal Links, native NFC read into the existing tag flow, haptics shim for iOS.
- **Depends on:** [NAT-5](<Native App — Master Book.md#nat-5>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Three separate bridges over existing web flows. NFC: the tag flow is `src/app/nfc/[tag]/`, `src/app/nfc/nfc-admin-client.tsx`, `src/features/nfc/hooks.ts` and `src/app/api/nfc/` — native read should feed the same slug route, not a parallel one (NFC Tags has its own slug-URL hard rule in its vault doc). App/Universal Links: the same slug routes plus `src/app/g/[tag]/` for the guest portal. Haptics: `src/hooks/useLongPress.ts` is the only current `vibrate` caller — shim there rather than scattering calls.


**Execution plan — 2026-09-26**

**Readiness:** Split first; one bridge per verified slice after distribution.

**Verify:** Device matrix for cold/warm App/Universal Link, existing NFC slug, unknown/invalid slug and auth return; test haptic/no-support branches and browser regression. Use existing NFC route semantics.

```delivery-plan-v1
{
  "outcome": "Add native links, NFC entry and haptics over the existing web flows.",
  "acceptance": [
    "The same valid tag resolves to the same web action.",
    "Unsupported native capability falls back without breaking capture."
  ],
  "scope": [
    "android/",
    "ios/",
    "src/lib/native/",
    "src/hooks/useLongPress.ts",
    "public/.well-known/"
  ],
  "steps": [
    "After NAT-5, inventory accepted URL domains/slugs and current NFC route behavior; verify current platform association requirements before choosing files.",
    "First slice: proposed platform/domain associations that open the existing route with correct auth return and web fallback.",
    "Second slice: native NFC feeds the same validated slug flow without creating a second tag engine.",
    "Third slice: wrap current haptics through a guarded native shim, then verify each platform and ordinary browser behavior."
  ],
  "invariants": [
    "Slug URLs and existing access checks stay authoritative.",
    "No geofencing or implicit location-triggered actions."
  ],
  "exclusions": [
    "New NFC data model, broader background automation or unverified alarm APIs."
  ],
  "checks": [],
  "risks": [
    "Cold-start link handling can process one tap twice or lose the auth destination."
  ],
  "unknowns": [
    "Platform association configuration and actual device capability behavior."
  ],
  "dependencies": [
    "NAT-5"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted N-05, current useLongPress and NFC entry seams reviewed; native directories/association assets are proposed as needed."
}
```

### NAT-8

- **Retained campaign gate (D3):** The PWA Non-Interference Contract holds — no code or DB change made for native reasons has altered the existing web/PWA deployment's behavior.

**Outcome:** Verify web and native install-scope separation.

- **Acceptance:** Test per-route PWA manifest isolation, independent installed identities and native registration guards on both phones. OUT-18 source change is not a full install witness; no native-motivated alteration of web behavior.
- **Depends on:** [NAT-2](<Native App — Master Book.md#nat-2>).

**Provenance:** [Native App — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Native App/Native App — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** `public/manifest.json` has `scope: "/"` and `id: "/budget-app"`; sub-app manifests narrow both (e.g. Outfits uses `/outfits-app` and `/outfits`). Wiring uses route `metadata.manifest`. Read the documented root-scope collision and owner install-order workaround before proposing scope/domain changes. SW registration happens in `ServiceWorkerRegistration.tsx` and `usePushNotifications.ts`; `public/sw.js` owns worker behavior. Acceptance needs both phones, including existing installations.


**Execution plan — 2026-09-26**

**Readiness:** Investigation first; verify both installed identities before changing scopes.

**Verify:** Owner tests root/sub-app install order on both phones, launch target, icon/title, cache/session behavior and native/browser registration. Include existing installations, cold start and reinstall; retain manifest identity receipts.

```delivery-plan-v1
{
  "outcome": "Prove web sub-app installations and native shell identity stay separate.",
  "acceptance": [
    "Installed identities launch the intended surface.",
    "Native additions preserve existing PWA behavior on both phones."
  ],
  "scope": [
    "public/manifest.json",
    "public/manifests/",
    "public/pm.webmanifest",
    "public/sw.js",
    "src/components/ServiceWorkerRegistration.tsx",
    "src/hooks/usePushNotifications.ts",
    "src/app/",
    "src/lib/native/"
  ],
  "steps": [
    "Record current manifest id/scope/start URL wiring and the existing install-order workaround; narrow any eventual source edit to a reproduced collision.",
    "Test root PWA, selected sub-app and native shell in both install orders on the actual Android/iPhone devices.",
    "If a conflict reproduces, inspect registration and launch routing before proposing a scoped remedy; changes to domains/scopes need an explicit reviewed migration path.",
    "Verify native-only guards and all original PWA launch paths; record device results separately from source implementation."
  ],
  "invariants": [
    "A viewport screenshot is not installation evidence.",
    "No automatic root-scope narrowing."
  ],
  "exclusions": [
    "General manifest redesign or claiming source-present OUT-18 proves device behavior."
  ],
  "checks": [],
  "risks": [
    "Scope changes can strand existing installations or make the root app capture sub-app links."
  ],
  "unknowns": [
    "Actual phone install/launch matrix after NAT-2."
  ],
  "dependencies": [
    "NAT-2"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Existing root/sub-app manifest contract reviewed; this is a device investigation with conditional source scope, not a confirmed defect."
}
```

## Shipped Log



Earlier shipped work is preserved in the linked pre-refactor record; no dated receipt is invented here.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.

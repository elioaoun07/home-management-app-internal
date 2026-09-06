---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Native App — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Native App — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Book delta

The entire Master Book and checklist were read. `git log --since=2026-07-30 --format="%h %ad %s" --date=short -- src/lib/pushSender.ts src/hooks/usePushNotifications.ts src/lib/supabase proxy.ts next.config.ts public/sw.js package.json` returned 1961cc9, e099060, bf81612 and 1f604a8. These are shared-web changes, not native implementation. The header/checklist were updated to the September plan despite the July frontmatter; the old pointer saying NAT needs registration is superseded by the existing NAT checklist and conventions.

| Book/snapshot claim | Verified correction |
|---|---|
| Root +9 per-route manifests | **16 total**: root `public/manifest.json`,14 `public/manifests/*.webmanifest`, and `public/pm.webmanifest`. NAT-2's16 is correct; the brief's14 is the per-route subset. |
|186 API route handlers |224 `src/app/api/**/route.ts` files, counted with Python Path.rglob at3106164 |
| Exactly5 offline feature types |6 union members at `src/lib/offlineQueue.ts:14`, including trip; this proves declared types, not every mutation's coverage |
| Native implementation0% | Still correct: `capacitor.config.ts`, `android/`, `ios/`, `src/lib/native/` absent; package.json has no Capacitor dependency |
| No iOS alarm API; Time Sensitive is the ceiling | The platform claim is obsolete; Apple documents AlarmKit for iOS26 with separate user authorization. The chosen v1 push scope remains a decision, not a platform ceiling. [Apple's AlarmKit presentation](https://developer.apple.com/videos/play/wwdc2025/230/) (checked2026-09-06). |
| “All modules keep working by construction” / permanent login | Source reuse is real; WebView behavior, session persistence and phone permissions remain acceptance questions, not consequences of shared code. |

**UNVERIFIED:** store accounts, mobile domain/deployment, device OS versions, installed builds, credential parity and current subscriptions. NAT-1 owner evidence and the device witness below settle these; do not read secrets or infer account state from absent repo files. External store prices/review timelines in the book were not revalidated and are not prerequisites this study certifies.

## Re-scored maturity

Retain the book's single implementation measure: **0% native shipped**. No invented dimension average. A +1 milestone is a running shell on the owner's physical phone with an attached cold-start/auth/bridge verdict; source scaffolding alone earns no delivery credit. Web/PWA maturity is inherited context, not native completion.

## Findings

1. **The shell inherits the correctness boundary, including its failures.** `src/lib/offlineSyncEngine.ts:256–276` drops4xx and retries5xx; `offlineQueue.ts:14` declares supported features. Phase2 E-09 identifies the missing ERA queue and server idempotency prerequisites. Native persistence cannot turn a duplicate-prone endpoint into exactly-once execution. Notifications' campaign study separately identifies differing Done semantics. **Priority: money/schedule correctness / honest recovery.** Native v1 tap-through is useful containment; do not add action parity before the domain action is safe.
2. **Deployment isolation is already correctly limited; its enforcement is still a witness, not topology.** The archived authoritative detail, `_Archive/Native App/2 - Architecture Decision.md:53–61`, forbids native-driven SW/manifest edits, preserves the web subscribe variant and requires a web regression gate. Yet NAT-2 loosely says “SW platform guards.” Resolve guards at the native bridge/registration caller unless an owner amendment explicitly changes the contract; do not edit `public/sw.js` under that phrase. Both deployments share DB and source, so web-only scheduler ownership and additive schema matter more than the domain split. **Priority: prevent regression.**
3. **The remote-shell production choice needs an explicit evidence threshold.** Capacitor7 documents `server.url` for live reload and says it is not intended for production. Its app-bound setting also constrains navigation and requires a matching domain list. This does not prove the owner's chosen architecture fails; it makes the physical-iPhone/auth/bridge/offline spike load-bearing, rather than routine setup. [Capacitor7 configuration](https://capacitorjs.com/docs/v7/config) (checked2026-09-06). **CONFLICTS → Native architecture certainty**, not an automatic switch to Stage2. **Priority: avoid committing owner time behind an unproved premise.**
4. **Native delivery must preserve the distinction between one event, recipients and endpoints.** `src/lib/pushSender.ts:59–80,203–216` has the zero-subscription/transport-status ambiguity described in Notifications; `src/hooks/usePushNotifications.ts:769–776` registers a device identity. An owner can retain a browser installation and add a native one. Reuse E-05's event identity and per-person policy, then fan out by transport; do not charge an extra interruption budget for each endpoint or rerun the business cron per deployment. **Priority: correctness / quiet household experience.**
5. **A platform limitation was mistaken for a lasting product decision.** AlarmKit is a separate native alarm path, not an upgrade to FCM push priority. It supports prominent alarms and per-app permission; support on the partner's phone and bridge integration are **UNVERIFIED** pending OS inspection and an isolated device spike. [Apple AlarmKit](https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit). **CONFLICTS → Master Book platform limitation matrix; EXTENDS → deferred local-alarm mirror.** Keep it outside N-03; reopen the ceiling only if a confirmed critical schedule occurrence can alert and cancel correctly without duplicating server delivery. **Priority: valuable capability without hidden scope growth.**

## Enhancement catalog

| Rank / ID | User-visible outcome | Size / severity | Mapping and dependency |
|---|---|---|---|
|1 · ASTRA-NAT-1 | The owner has a recorded go/no-go for relying on the native shell, including preserved PWA behavior. | M / blocker | DOCKS → N-02; EXTENDS → NAT-3 acceptance and NAT-2 non-interference; NAT-1 → shell implementation portion → owner device witness → N-03 |

This is a bounded acceptance sheet, not a second native build plan. N-00/01/03/04/05 remain the implementation owners. **DOCKS → E-05 / N-03** for the shared event/recipient/transport contract; **DOCKS → E-09** for queue inheritance. **CONFLICTS → NAT-2 versus Non-Interference §2** on SW edits, and the platform/remote-shell claims above, are Phase5 register inputs. **NEW, held:** a version-gated AlarmKit feasibility check extends the deferred alarm mirror; no implementation packet before the owner changes the ceiling.

## What ERA needs from this module

Native contributes **capability facts**, not another assistant or briefing producer: platform/version, push/alarms permission state, registration state and supported deep-link route. An accepted push token is not receipt proof; a revoked permission must invalidate the capability fact. Domain occurrence identity and completion remain Schedule's contract.

N-03 consumes the E-05 payload and lands at the existing ERA/module door. E-04 may later expose unavailable delivery capability only through the existing health surface; no new native dashboard or explanatory onboarding banners. Keep private platform tokens out of model context.

## Do not do

Do not add a frontend fork, separate native sync queue, native business cron or alternative recurrence expansion. Do not fund Stage2 or a plugin migration merely because upstream discourages the locked Stage1 choice; record evidence and ask the owner to resolve the actual tradeoff. Do not promise permanent login, alarm reliability or offline cold start from package installation. Do not expand v1 tap-through actions. Do not treat Watch UI as a shipped native companion.

## Coverage note

Owns native distribution/platform integration and the **Watch UI** orphan's platform-facing concerns. Watch domain reads/writes remain Budget/Hub contracts; `ERA Notes/01 - Architecture/Feature Map/standalone/watch-ui.md` routes its existing web surface. NFC/Guest Portal URL identity stays with their existing Hub & ERA coverage; native transport adds a door, not new tag identities. Sync & Offline is cross-cutting, owned through the Hub/Top Layer study, not transferred to Native.

## ASTRA 10× Findings

- **Leverage 1:** Qualify the iPhone remote-shell premise before paying for native push integration; one failed premise otherwise multiplies through every plugin.
- **Leverage 2:** Add transport behind the existing send boundary, with one shared event identity and per-person policy.
- **Simplification:** Keep v1 notifications as tap-through and reuse the web precision tools; avoid a second background action implementation.
- **Frontier — NEW, held:** A version-gated AlarmKit bridge could mirror already-materialized critical occurrences. Measure actual locked-phone alert and cancel behavior first; no new scheduler or automatic completion.
- **Uncomfortable:** The book promises both construction-level certainty and an unverified go/no-go spike. The spike is the truth; shared source is only the reason the experiment is affordable.


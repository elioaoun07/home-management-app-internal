---
created: 2026-07-24
updated: 2026-07-25
type: reference
status: living
owner: Elio
tags: [pm/reference, tooling/delivery]
---

# Delivery 10x — Design Debates & Rejected Ideas

> **Why this file exists:** the campaign was shaped by two analyses — a code-forensic postmortem (this repo's session files) and an external AI critique the owner used to sharpen direction. The owner's standing instruction is *challenge proposals, don't absorb them*. This file records the disposition of every contested idea so future sessions don't relitigate. The external critique's structural contribution — **outcome milestones over a flat bug list, and governance over repair** — was adopted; individual items below were judged on their own merits.

## Adopted (with right-sizing)

| Idea | Disposition |
|---|---|
| Outcome milestones instead of 14 flat fixes | ✅ Adopted — M1–M4 structure (file 2). |
| Budget controls, scope tripwire, model guard to **Now** | ✅ Adopted — they are M1/M2's core; the original draft had them mid-list. |
| Risk-based validation instead of "always full ladder" | ✅ Adopted (DLV-11) — with the amendment that *skips are always explicit and authorized*, because silent `(skipped)` lines are exactly what the failed session produced. |
| FAST/DEEP lanes | ✅ Adopted as FAST/STANDARD/DEEP policy bundles (DLV-6) — but lanes never alter gate count (see rejections). |
| Context budgets, selective loading, loaded-context manifest | ✅ Adopted (DLV-8) — as v2 of the existing `context-assembly.mjs`/`context-policy.mjs`, not a new engine. |
| AC coverage matrix, evidence-backed completion, remaining-work package, revert instructions, risk register, PARTIAL outcome | ✅ Adopted (DLV-10, DLV-12) — PARTIAL expressed via existing states + `awaiting.reason`, no transition-table change without owner approval. |
| Failure-injection / crash-recovery / retry-storm / quota testing | ✅ Adopted (DLV-18) — as scenario cases on the existing fake driver + `tests/delivery/run-session.test.ts`, **not** a new test framework. |
| Stalled-session watchdog, transcript integrity | ✅ Adopted (DLV-17). |
| Preflight summary / launch recommendation screen | ✅ Adopted and promoted to M1 centerpiece (DLV-2 Flight-Check). |

## Rejected / deferred

| Idea | Disposition | Rationale |
|---|---|---|
| **Automatic provider fallback** (Claude↔Codex mid-session) | ❌ Rejected | Cross-provider auth, cost, and behavior differences make silent fallback risky; the DW layer already supports **deliberate** provider handoff/rotation at a human gate. A failing provider should pause and ask, not silently switch who is editing the tree. |
| **Remote decision controls** | ❌ Rejected (reframed) | pm-server is loopback-bound by design (net-guard; `--lan` is the only sanctioned widening). Exposing gate decisions remotely reverses the security posture. What survives: push notifications (DLV-16 → DLV-22) deep-linking into the dashboard the owner already trusts — **and, 2026-07-25, the amendment below.** |
| **Ungated AUTO lane** | ❌ Rejected as-is | Conflicts with the owner non-negotiable "always 3 gates" (base plan `_index.md`, locked 2026-07-11). FAST compresses effort/context/validation, **not oversight**. If the owner ever wants gate-free doc-only deliveries, that is a recorded revision of the base rule, not a lane flag. |
| **Formal S/M/L benchmark + Delivery-vs-direct-CLI comparison** | ❌ Rejected | A measurement science project for a solo owner with 8 sessions of history. The same questions are answered continuously and for free by DLV-19's fleet metrics (cost per shipped item, first-pass validation rate, intervention rate, scope-estimate accuracy). Revisit only if fleet volume makes A/B meaningful. |
| **Conversation search & highlighting** | ⏸ Deferred | Real but polish-tier; not on the dependability path. Candidate for a Later DLV item once M1–M3 ship. |
| **"Avoid locking exact files/functions too early"** | ◐ Partially rejected | This repo's playbook culture works *because* docs anchor to verified files. Compromise: the Action Plan anchors files as starting points with a freshness protocol, and specifies contracts, not diffs. |
| **Idempotent transitions / duplicate side-effect prevention as new work** | ◐ Right-sized | The transition table is already pure and crash reconciliation exists. This became *verify-and-harden* inside DLV-18's scenarios (e.g. PM-writeback idempotency in DLV-14's acceptance) rather than a standalone rebuild. |
| **Mid-session model/effort switching, pause/resume/cancel, provider switching** | ✅ Already exists | Shipped in the DW campaign (`/api/delivery/control`, `controls/`, handoff flow). The 10x work surfaces them better (DLV-15), it does not rebuild them. |

## Amendment (2026-07-25): "Remote decision controls" — revoke-tier and envelope-gated launch adopted; gate approval still rejected

The 2026-07-24 rejection above was written against a specific transport: widening `pm-server`'s own binding so gate decisions could reach it directly (LAN/tunnel/exposed port). **DLV-20/DLV-21/DLV-22 (Mobile Command Surface, `/pm/live`) use a different transport that the original rejection did not evaluate** — an outbound-only Supabase relay (`scripts/pm/bridge.mjs`, `migrations/2026-07-25_pm-mobile-relay.sql`). The laptop makes outbound calls to Supabase and polls/subscribes for commands; nothing inbound ever reaches `pm-server`, `hostAllowed()` is untouched, and the `127.0.0.1` default never widens. This is strictly safer than the already-sanctioned `--lan` widening, not a reversal of it.

What changed as a result — a revision of the rule, made explicitly, not a slip:

| Tier | Commands | Disposition |
|---|---|---|
| **Revoke** (can only reduce a running session's authority) | `pause`, `abort-turn`, `cancel` | ✅ Adopted — always reachable from mobile. Worst case under a compromised channel: a session stops. Nothing is written. |
| **Grant, narrowly** | `launch` (envelope mandatory, no default; refuses on a dirty tree or red baseline because mobile never forwards the typed ack); `answer` (only when the session is *currently* awaiting the `question` gate, verified server-side before the reply is sent, not just hidden in the UI) | ✅ Adopted, deliberately constrained — see DLV-20/21 in [1 · Feature State](<1 - Feature State.md>). |
| **Still rejected** | Any decision on the `spec` / `plan` / `uat` / `blocked` gate; `set-budget`; `set-config`; `rotate`; `fork` | ❌ Still rejected, unchanged. Authorizing a spec/plan/UAT gate, or raising a budget envelope, from a phone that might be used one-handed on a bus is not a risk this campaign accepts. Those stay laptop-only. |

Why launch is a *narrower* grant than it looks: `execLaunch()` in `scripts/pm/bridge.mjs` calls the exact same `POST /api/delivery/start` the desktop wizard calls, with the exact same server-side guards (flight-check review, valid lane, budget envelope, `buildItemIdentity` drift check, `findActiveSessionForItem`/`isBuildLockActive`). The bridge adds no new authorization surface — it forwards to `routeDelivery()` and simply never supplies `dirtyAck`/`redBaselineAck`, so a dirty-tree or red-baseline launch attempt refuses with the same 400 the desktop UI would show, by construction rather than by client-side hiding.

Also fixed while implementing: `budgets.mjs`'s `raiseBudgetEnvelope()` is raise-only (there is no lower-envelope primitive), so a "decrease-only `set-budget` from mobile" idea considered during design turned out to be unimplementable without new budget logic — and unnecessary, since Pause/Cancel already fully cover "stop the burn." **Consequence to keep in view:** a session parked at the `budget` gate can be cancelled from mobile but not revived — reviving requires a raise, which requires the laptop. `/pm/live` surfaces this as "Raise envelope on laptop," not a dead button.

## Amendment (2026-07-25, same day): mobile checkbox ticking — adopted at 01:20, revoked at 11:30

The Mobile Command Surface shipped with `tick` in its allowlist: the phone's checklist rows were checkboxes, and tapping one round-tripped through the real `toggleCheckbox()` mutation onto disk. Within two minutes of the bridge going live for the first time, a tap marked a real PM item done — silently, with no confirmation, no visible trace, and no way back (observed against `Budget/4 - Checklist.md`, 11:17:29). The owner's report: *"I have no idea which one was it."*

| Idea | Status | Reasoning |
|---|---|---|
| **Mobile checkbox ticking** (`tick` command) | ❌ Rejected, after shipping | Three failures compounding: (1) **the whole row was the hit target** on a glanceable, one-handed surface where stray taps are the norm; (2) **the mutation was silent** — no confirm, no toast, no Undo (a violation of Hard Rule 1's spirit on a non-`src/` surface the rule's letter didn't reach); (3) **ticking hid the row**, because the board filters `state === "done"`, so the evidence of the mistake removed itself from the screen. Marking work done is an assertion about reality that the entire PM Command Center is built on — it must not be one unconfirmed tap away on a phone. |
| **Fix it with a confirm dialog / long-press instead** | ❌ Rejected | Would keep a done-marking capability on the phone at the cost of a modal on the highest-frequency gesture. The capability itself has no demand behind it: the owner's actual mobile intent for a checklist row is *"start work on this"*, not *"declare this finished."* Removing beats guarding. |
| **Tap a row → launch a delivery session** | ✅ Adopted (DLV-23) | The row now opens the flight check for that item — every existing launch guard still applies (mandatory envelope with no default, dirty-tree/red-baseline refusal, drift check, build lock), so a stray tap costs a preflight run and a sheet the owner can close, never a state change. Done-marking returns to where it belongs: the *outcome* of a delivery session (`ACCEPTED` writeback), or a laptop edit. |
| **Journaled, revertible bridge writes** | ✅ Adopted (DLV-23) | Removing `tick` fixes today's incident; it does not fix the class. Every file write the bridge performs now stores a full pre-image under `.delivery/pm-undo/` and appends to an append-only journal; the newest un-undone write is offered as an Undo strip on the phone, and `undo` refuses instead of clobbering if the laptop touched the file since. Any future mobile writer inherits this for free. |

**Enforcement is server-side, not UI-side.** `tick` is refused by the bridge (`REFUSED_TYPES` in `scripts/pm/bridge.mjs`) and dropped from the `pm_commands.type` CHECK constraint — not merely removed from the client. `/pm/live` is an installed PWA; a phone running a cached older bundle can still issue the command, so the only removal that counts is the one on the laptop.

## Standing tensions to keep in view

- **Governance friction vs launch speed.** Mandatory budget fields + acknowledgments add clicks to every launch. Accepted deliberately: the flight-check is the product. Lane defaults (FAST pre-fills a small envelope) keep the S-item path to ~3 confirmations.
- **Runner-enforced truth vs agent autonomy.** DLV-10 moves AC status from agent prose to runner reconciliation — more machinery, less trust in the model. The failed session settles this: the economy model *will* over-claim, so truth must be structural, exactly as the git ban is enforced by construction rather than by prompt.
- **"Unset until baselined" is dead.** The base plan's token-budget stance (no defaults until a benchmark runs) produced two uncapped runaway sessions on the same item. Defaults may be imperfect; absent envelopes are worse. Recorded as an owner-direction change, 2026-07-24.

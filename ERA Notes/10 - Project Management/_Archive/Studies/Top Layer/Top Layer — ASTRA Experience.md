---
created: 2026-09-05
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# Top Layer — ASTRA Experience

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff: `3106164` (2026-09-02). Deltas [Hub & ERA — Master Book](<../../../Hub & ERA/Hub & ERA — Master Book.md>) at `updated: 2026-09-02`. Phase 2 study only; behavior specifications below are not shipped UI.
>
> Evidence IDs A1–A17 and contradictions C01–C16 resolve in [Architecture](<Top Layer — ASTRA Architecture.md>). [Completion](<Top Layer — ASTRA Completion.md>) supplies proof; [Packets](<Top Layer — ASTRA Packets.md>) supplies bounded execution.

## 1 · Keep the interface; make its claims dependable

The orbital mark, three views, scatter widgets, navigation, embedded/floating CommandBar and chat drawer already form the interface (`src/components/era/EraShell.tsx`, 550 LF lines). Preserve their coordinates, hierarchy and animation. Add the already-planned briefing card, state indicator and vitals only at their sanctioned insertion points. No new explanatory UI copy is proposed here (brief C5/C6; Hard Rule 28).

**DOCKS → E-09/E-11:** the first experiential improvement is that a cleared command no longer means a lost capture. The user can distinguish a proposal, a saved draft, a durable pending capture and a completed action without reading a paragraph. **DOCKS → E-05/E-06:** a stored briefing and a phone delivery have separate evidence. Existing success decoration may be shown only for the state it actually represents [A1–A8/A12].

All state names in this document describe implementation/test semantics, not text to ship.

## 2 · Two ladders, different meanings

| Interaction ladder — cost of an individual interaction | Behavior / plan owner |
|---|---|
| L-0 glance | Existing dashboard facts plus E-10/E-15 status/vitals; stale and unavailable facts remain distinguishable. |
| L-1 one-tap draft action | E-20 card invokes a typed capability through the same confirmed-action boundary. A money proposal opens/saves a draft, never silently posts money. |
| L-2 owning-module door | Open the relevant record/date/scope in the precision tool. A module landing is a fallback when the entity is gone, not proof it still exists. |
| L-3 sentence | CommandBar or existing voice entry invokes the same turn boundary, with the same validation, queue and confirmation guarantees. |

| Proactive ladder — what ERA initiates | Completion condition / dependency |
|---|---|
| L0 answers | Existing deterministic routes; E-08 closes balance/meal/context gaps. |
| L1 scheduled static | E-02/E-03 schedule and liveness exist; a static push alone does not meet the L2 goal. |
| L2 composed ranked brief | E-04/E-05 deterministic facts, provenance, correct recipient/local date and observed delivery. Target remains Oct 12. |
| L3 brief with attached draft action | E-19 delivery policy before E-20 actions; no new transaction/recurrence engine. Target remains Dec 7. |
| L4 learns from feedback | E-23 uses explicit feedback; no response is not positive feedback. First loop target remains Dec 31. |

Source: Master Plan §2/§4/§5. “Phase 2 study” in this document is the ASTRA session phase; numbered product phases are the Master Plan's delivery windows.

## 3 · Surface-by-surface contract

Each row preserves the existing surface. “Door” specifies behavior, not new navigation copy.

| Surface / mapping | In one second | One tap | Door | Degraded / offline / quota exhausted |
|---|---|---|---|---|
| Orbital mark — **DOCKS → E-15/E-17** | Existing interaction state. It is not a proxy for data freshness or successful storage. | Existing open interaction is preserved; no new gesture or animation specification. | Existing conversation surface. | Data can remain visible while conversation is inactive. Existing text entry remains usable when speech output fails. No success indication based only on audio playback. |
| Hub view — **DOCKS → E-10/E-20** | Existing greeting and widgets, plus one stored briefing card at E-10's sanctioned position. | Expand the selected briefing or invoke its explicitly confirmed draft action. | Provenance-derived owning record, or the same stored briefing from push. | Persisted card carries its actual as-of time. Yesterday's content never masquerades as today's. A source failure cannot become a complete “all clear” [A13]. |
| Dashboard view — **DOCKS → E-14/E-15** | Existing four-face facts with their original layout. | Existing face/tile selection. | Budget/Schedule/Recipes/Brain precision tools at current routes. | Render valid cached facts with age; unavailable totals remain unavailable. Do not substitute zero when a request fails or mix currencies in a new sum [A13; Architecture §4]. |
| Activity view — **DOCKS → E-11/E-06** | Actual completed/draft events and the planned small vitals block. | Open the event's existing entity/date; feedback affects the referenced briefing only. | Reminder: `/reminders?openId=...` with date where needed; money: existing transaction detail; memory: `/era?face=brain`. | Query failure is not empty history. Queued captures are not presented as server-completed actions. Logging failure never invites repeating a completed money action [A8]. |
| CommandBar — **DOCKS → E-01/E-09/E-11** | Existing input, available action and request state. | Submit once through the shared dispatcher; repeated taps reuse/block the same in-flight request. | When a write cannot be accepted, retain recoverable input and expose its existing precision-tool door. | E-01 refuses honestly; E-09 acknowledges only committed local storage. Endpoint timeout/abort is not offline. Quota gates only AI; deterministic actions remain available [A3–A5]. |
| EraChatDrawer — **DOCKS → E-11/E-10** | The current conversation and outcome of the last turn. | Confirm a proposal, continue a clarification, or open the affected entity. | The same record the capability actually returned, not an inferred entity from response prose. | Conversation persistence failure is separate from domain success. Keep a pending proposal usable until confirmed/cancelled; do not learn from rejection or partial failure [A2/A4]. Existing backdrop/restyling debt is C11. |
| Briefing push — **DOCKS → E-05/E-16/E-19** | One eligible local-date briefing for that recipient, bounded by delivery policy. | Open the stored briefing ID. Notification action paths use the same authenticated endpoint as in-app feedback. | `/era`, registered in both notification routing and service-worker handling. | No subscription/configuration is an observable failure, not “delivered.” Offline tap uses stored cache only if present; quota has no effect on deterministic composition [A12]. |
| Push landing — **DOCKS → E-10/E-11** | The briefing that was tapped, with its date and actual provenance. | Open one supported signal or its owning record. | Preserve briefing ID across sign-in; check recipient authorization after sign-in. Invalid face parameters are ignored safely. | A cold/offline landing with no cached record cannot fabricate a briefing. A prior-day notification opens that prior-day record, never silently swaps in today's. |

**Evidence:** `CommandBar.tsx` clears before awaiting the turn; `ArtifactsView.tsx:34,50,70` collapses absent data into an empty history and navigates stored routes; `src/lib/notifications/registry.tsx:90` currently omits `/era` from `VALID_PAGE_ROUTES`. `src/features/era/logEraAction.ts:133` already emits the Brain query parameter. E-11 must make the route and mount behavior agree.

## 4 · One capture, including all failure branches

**DOCKS → E-09/E-11.** Reference fixture: a $5 expense draft against an owner-owned USD wallet whose stored balance is $100. Saving or replaying the draft leaves the stored balance $100. Confirmation is a separate Budget operation; the queue does not confirm it. The command's acknowledged object is the draft, not a final expense [A6].

| Transition | Required behavior | Evidence that settles it |
|---|---|---|
| Submit while online | Preserve a stable request ID before the request; show a saved draft only after the authoritative response. | Response ID matches exactly one transaction with `is_draft=true`. |
| Confirmed offline before send | Store the validated create in the existing transaction queue; acknowledge only on IndexedDB transaction commit. | Close/reopen the app; the same request still exists. |
| IndexedDB unavailable or transaction aborts | Retain recoverable input; no durable-queue claim. | Forced storage-failure fixture; zero acknowledged durable captures. |
| Server commits but response disappears | Preserve uncertain outcome and reconcile by request ID. | Retry returns the same row ID; row count remains one. |
| Reconnect | Replay the same identity under the captured owner; replace temporary IDs, refresh Drafts and relevant ERA data. | One server draft, no stranded temporary duplicate [A17]. |
| Account/user changes before replay | Do not replay under the new user. Keep recoverable work isolated to its owner. | Owner-mismatch fixture causes zero POSTs. |
| Cancel before replay | Remove only the pending create under queue serialization. | Reconnect creates zero rows. |
| Undo after replay | Use the existing draft deletion path with the real ID. | Draft disappears; stored balance remains $100. |
| Nonretryable rejection / retry exhaustion | Keep payload recoverable with a terminal error state; do not silently delete the only record. | Operation remains inspectable; no automatic retry storm. |
| AI proposal declined | No domain write and no successful template learning. | Zero write calls and unchanged match count. |

No new undo/toast subsystem. Mutation-confirming toasts use the existing inverse and `ToastIcons`. A read error or a rejected request has no inverse to offer; do not invent an Undo that retries a write. Hard Rule 1's literal “all toasts” wording needs a Phase-5 contradiction entry for nonmutating error notices; preserve its purpose for acknowledged mutations.

## 5 · Two people, one identity

**DOCKS → E-16; CONFLICTS → C10 in Architecture.** Authorization, attribution and color are separate. Selecting a partner's face/color cannot authorize access. A request is evaluated using the authenticated viewer and current household link; a record's person identity is stable across viewers. Do not infer the actor from “current user” alone when displaying an existing event.

Partner delivery is daily from day 6 after five owner-only mornings (D6), with her own hour/toggle. Required proof covers both authenticated phones, both directions of household visibility, and a nonlinked-user refusal. A screenshot from the owner's phone cannot verify the partner's result.

The color implementation cannot proceed from viewer theme alone when the same person can appear under independently selected themes. Owner confirmation of a persistent mapping resolves C10. Until then, preserve existing appearance and keep new person-color rollout blocked; do not normalize an unverified helper as the identity source.

## 6 · Treaty as a behavior-preservation checklist

**DOCKS → E-10/E-13.**

| Before deletion | Parity proof required | Removal that becomes possible |
|---|---|---|
| Floating assistant generates reports | Same authorized question invokes existing report generation and renders existing `AnalysisDashboard` inside ERA; saved reports remain reachable. | `src/components/ai/AIChatAssistant.tsx` and its loader in `src/components/DeferredComponents.tsx`. |
| Hub voice invokes legacy callbacks | A confirmed reminder at 09:00 produces one correct item; reply appears in household chat, without an extra ERA conversation. | Sanctioned E-13 legacy branch/callback removal; HubPage LF line count strictly below 6,275. |
| Separate assistant histories confuse ownership | New assistant turns persist according to explicit host policy; existing analysis history remains read-only/reachable under D4. | No new fourth store or wholesale migration of household messages. |

A success in the new path does not authorize deletion of untested report history. An equivalent layout screenshot does not prove equivalent persistence. The executor must satisfy both behavioral and visual gates.

## 7 · Mobile and accessibility proof, without redesign

**DOCKS → E-10/E-15/E-16.** Capture 390×844 on both phones/themes and 1440×900 desktop before and after each additive UI packet. Compare existing element bounds and order; no moved orb, face navigation, widgets or changed animation. New content must not hide controls behind fixed headers, bottom navigation, the keyboard or safe-area insets (Hard Rules 5/16).

New floating panels use `tc.bgPage` with opaque surfaces. Existing styling conflicts remain in Architecture C11 for owner review, not an incidental restyle. Focus must reach new actions by keyboard; accessible names identify their action without adding inline explanations. Number entry uses text inputs with decimal input mode. A color never carries the sole distinction between failure, pending and completion.

Tests cover the state matrix; screenshots cover the frozen appearance. Existing TS-only tests cannot establish component behavior until E-01 includes TSX and E-15's expressly allowed test dependencies are installed [A14]. Do not install them during this study or silently pull that dependency change into another packet.

## ASTRA 10× Findings

- **Leverage 1 — DOCKS → E-09/E-11:** preserve one capture through restart, reconnect and temporary-ID replacement. This removes repeated entry and uncertainty at the highest-frequency interaction [Architecture A3–A7/A17].
- **Leverage 2 — DOCKS → E-10/E-20:** the push, landing, card and module door share one stored briefing identity and provenance. The owner investigates the same fact they were notified about, including yesterday's notification (§3).
- **Leverage 3 — DOCKS → E-14/E-15:** cached facts remain useful while the conversational layer is unavailable; explicit freshness prevents a cached screen from falsely claiming today's state [A13].
- **Simplification — DOCKS → E-10/E-13:** preserve reports and household chat while removing duplicate assistant entry ownership; no interface redesign is needed (§6).
- **Frontier — None found with sufficient evidence:** an additional interaction concept would compete with the locked additive interface. The existing ladders already cover the verified use cases.
- **Uncomfortable — CONFLICTS → Hard Rule 1 literal scope:** a failed, nonmutating operation cannot honestly offer an inverse. Making every error look undoable weakens the successful-action meaning of Undo; keep mutation inverses real and carry the wording conflict to Phase 5 (§4).

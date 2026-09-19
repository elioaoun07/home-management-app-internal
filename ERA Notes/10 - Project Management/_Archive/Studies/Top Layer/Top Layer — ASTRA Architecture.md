---
created: 2026-09-05
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../_index.md>); unchecked boxes here are historical proposals.

# Top Layer — ASTRA Architecture

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff: `3106164` (2026-09-02). Deltas [Hub & ERA — Master Book](<../../../Hub & ERA/Hub & ERA — Master Book.md>) at `updated: 2026-09-02`. Phase 2 study only; no implementation or production verification.
>
> Read with [Experience](<Top Layer — ASTRA Experience.md>), [Completion](<Top Layer — ASTRA Completion.md>), and [Packets](<Top Layer — ASTRA Packets.md>). Packet suffixes below refine existing plan IDs; they are document identifiers, not a new PM prefix.

## 1 · Architectural verdict

ERA's useful boundary already exists: deterministic interpretation, a capability catalog, and human-confirmed AI proposals. Keep it. The missing boundary is **what counts as an accomplished action**. Today a proposal, a saved draft, a replayable request, a confirmed transaction, and an Activity entry can each be mistaken for success at a different layer. This is a correctness problem before it is a conversation problem [A1–A7].

**DOCKS → E-09 / E-11:** establish explicit outcomes and a durable request identity at the existing write boundary. **DOCKS → E-04 / E-14:** give shared facts freshness and completeness so answers, widgets and briefings can reuse them without turning read failures into zeros. **DOCKS → E-05 / E-06:** separate stored briefing, attempted transport and observed delivery. These are the three highest-value changes, ranked by Design Doctrine §5: money/schedule correctness → trust → capture speed → coherence → foresight → polish.

This is a junction study: ERA connects Budget, Schedule, Kitchen/meal planning, memories, Notifications, Household Sharing and Sync & Offline. Business rules stay in their owning modules or shared libraries. The registry orchestrates them; it does not become another balance, recurrence or aggregation engine (CLAUDE.md Module Model; Master Plan D3/D11 and §5 E-04).

## 2 · Repository evidence and corrected premises

References are repository-relative, at the cutoff commit. A line identifies the relevant branch, not a claim about deployed behavior.

| ID | Verified implementation | Consequence / correction |
|---|---|---|
| A1 | `src/features/era/capabilities/registry.ts`: 13 entries; `capabilities/types.ts` permits optional `ok`. `intents/resolveIntent.ts:126` executes a capability, unconditionally calls `bumpTemplateMatch`, then drops `ok`. | Failed taught actions can gain rank. The registry is not the only execution path: transaction drafting calls the injected resolver dependency directly. Fixing only `capability.execute()` misses everyday capture. |
| A2 | `src/features/era/useEraTurn.ts:223` resolves; `:232` dispatches action logging without an outcome gate. `useEraAskAI.ts` has a separate confirmed-capability path and learning gate. | A change must reach deterministic, taught and AI-confirmed paths. Optional `ok` is not a complete lifecycle contract. |
| A3 | `src/features/era/useEraBudgetSubmit.ts:88` POSTs `/api/drafts`; `:154` catches exceptions as `reason: "offline"`. No ERA caller of `addToQueue` was found by `rg -n addToQueue src/features/era src/components/era` (no matches). | Offline ERA capture is not durable. The formatter has an explicit refusal; “silently lost” overstates every visible path. The precise defect is input can be cleared without a durable capture. Timeout, parsing and connectivity failures are also conflated. |
| A4 | `src/features/era/useEraConversation.ts:10` claims queue behavior; the implementation has in-memory ordering. `:49,92` are GET reads. `src/components/era/CommandBar.tsx` clears input before the turn completes. | The queue comment is false. These two GETs are not violations of the rule against raw mutation fetches. Neither a conversation row nor an optimistic bubble proves a domain write persisted. |
| A5 | `src/lib/offlineQueue.ts:94` generates operation IDs; `:172` resolves on request success, not transaction commit; its fallback can return an ID for memory-only storage. `src/lib/offlineSyncEngine.ts:198,267` removes exhausted/terminal operations; `:221` replays POST without a stable server idempotency contract. | “Queued” currently cannot mean “survives restart.” Retrying after an ambiguous network response can duplicate a create; deleting a failed operation loses the recovery payload. |
| A6 | `src/app/api/drafts/route.ts:98` creates a row in `transactions` with `is_draft: true`, using a server-generated ID. `drafts/[id]/route.ts:59` promotes it before `:81` adjusts the account balance. | Draft capture and confirmation are separate operations. Replay only the former until confirmation atomicity is repaired in Budget. Drafts Overview §Database calls the table `transaction_drafts`; that is stale. |
| A7 | `src/features/era/useEraAskAI.ts:251,263` creates an item then its NFC prerequisite. `src/app/api/items/route.ts:92,129,145,276` inserts parent and children separately, logging some child failures and still returning success. | A failed second request can leave a real item after a failure reply. Passing prerequisites in the existing combined body alone does not make the write atomic. Nonrecurring item creation needs one transaction before offline retry is enabled. |
| A8 | `src/features/era/logEraAction.ts:44,62,119,133` supports several deterministic entities; `:176` restricts the capability logger to `reminder.*`; `:143` posts best-effort. `widgets/useEraActivity.ts:17` converts failures into an empty array. | The brief's “era_actions only logs reminders” is too broad. Activity is incomplete and can display a false empty state; it is not a financial audit log. |
| A9 | `src/app/api/era/messages/route.ts` contains no conversation timestamp update; `migrations/db-state.json` embeds `generated_at: 2026-08-04T10:06:44.439516+00:00`. | **UNVERIFIED:** live timestamp trigger and intent-face CHECK. Settle with owner-refreshed `migrations/db-state.sql` output plus the constraint query in Completion. Do not assert that a trigger is absent from application silence. |
| A10 | `src/lib/ai/eraAskProposal.ts:345` rejects invented IDs and resolves the FOCUS sentinel from supplied focus; `src/app/api/era/ask/route.ts:60` accepts reminder focus. | Validation constrains model output; it does not establish database ownership of client-supplied focus. The authenticated domain route must authorize every entity on confirmation and replay. |
| A11 | `src/app/api/era/ask/route.ts:177` asynchronously records estimates, `:194` labels the model from `GEMINI_MODEL`; `src/lib/ai/eraAskProposal.ts:220` reduces the provider response to proposal/text. | The proposed quota gauge would graph incomplete input/output estimates and can misattribute fallback use. The `ai_messages` columns in `migrations/schema.sql:337` have no usage-basis/attempt metadata field; E-07a therefore includes an additive manual migration. A moving gauge is necessary, insufficient evidence of accurate accounting. |
| A12 | `src/lib/pushSender.ts:53` initializes `sent: 0, allFailed: false`; missing configuration/subscriptions return early; `:181` computes `allFailed` only after sending. | `!allFailed` does not prove even one push was accepted. `sent > 0` measures transport acceptance, not device display. |
| A13 | `src/app/providers.tsx:23,154` persists an explicit stable-key allowlist without ERA. `src/features/era/widgets/useBudgetSummary.ts` and `useChefSummary.ts` substitute empty results for failed reads. | E-10/E-15's offline reload needs explicit bounded persistence. A failure must not become a reassuring zero in a signal. |
| A14 | `vitest.config.ts:12` includes `src/**/*.test.ts` and `tests/**/*.test.ts`, omits TSX, and sets `passWithNoTests: false`. `.github/workflows/check-docs-sync.yml` is the sole workflow. | 43 source tests are all TS; 61 additional test files exist under `tests/`. Pure routing tests exist; the turn/conversation/Ask-AI hooks, ERA routes and components lack direct coverage. CI runs none of them. |
| A15 | `src/features/era/intents/budget.ts:78,185` vetoes income; `intents/schedule.ts:53` excludes events. Registry has neither balance nor meal-plan read; `api/era/ask/route.ts` supplies Budget/Schedule context only. | E-08/E-09 are real daily gaps. Extending focus beyond reminders must follow new capability ownership tests, not simply broaden the Zod enum. |
| A16 | `src/components/ai/AIChatAssistant.tsx:1185` renders `AnalysisDashboard`; `src/app/api/ai-chat/route.ts:251` calls existing report generation. `src/components/DeferredComponents.tsx:8` owns the floating loader. | Preserve current and saved analysis reports before deleting the floating assistant. There is no separate `DeferredAIChatAssistant.tsx` file to delete. |
| A17 | `src/lib/offlineSyncEngine.ts:24` omits Drafts from transaction invalidations. `src/contexts/SyncContext.tsx` recognizes top-level, item and subtask response IDs, not `{draft:{id}}`. | Posting an ERA draft through the existing queue without adapting reconciliation can leave the temporary draft and stale Drafts view behind. |

Ground truth corrections accepted in Phase 1 remain authoritative: HEAD is already committed; no git-writing “commit WIP” step is authorized. Six cron route files do not establish six scheduled jobs. The Hub & ERA score 4.2 is a historical July assessment, not an unscored campaign. The stale DB snapshot is not current production evidence. No DB calls were made for this study.

## 3 · Confidence contract at the existing boundary

**DOCKS → E-11; packet E-11a.** Normalize execution into a discriminated result at the dispatcher, with adapters for existing resolvers. Do not rewrite all business functions merely to standardize return shapes.

| Semantic result | May claim accomplishment? | Learning / focus / ledger |
|---|---|---|
| `proposed` / `needs_input` | No domain change | No success-learning or completed-action entry |
| `saved_draft` | Draft ID exists; no confirmed money movement | Draft event only; separate confirmation action |
| `applied` | Authoritative entity ID and version/result returned | Learn once; focus only an extant authorized entity; log once |
| `queued` | Durable local transaction committed; request ID retained | No server accomplishment or success-learning yet |
| `failed` | Known refusal/error, with retryability classification | Preserve recoverable input; no success-learning |
| `unknown` / `partial` | Request may have committed, or only part did | Reconcile by request identity; never blind retry or claim nothing changed |

Keep these as machine semantics, not proposed UI strings. Carry structured failure class, request ID, entity reference, and permitted inverse where relevant. Record the canonical outcome in existing `era_messages.intent_payload`; use existing `era_actions` for the owner's concise history, not a new event store. A telemetry failure must not downgrade an already-applied money operation or encourage its resubmission [A2/A6/A8].

**DOCKS → E-09; packets E-09a–d.** A create request gets one UUID before the first network attempt. Persist that identity and the authenticated owner with the existing queue operation. Enqueue only for confirmed connectivity loss, never just an endpoint timeout or caller abort (Hard Rule 6). An uncertain response is reconciled by identity; a retry reuses the same payload and identity.

Proposed additive columns on the existing destination tables, subject to manual migration: `client_request_id` and `client_request_hash`, unique per owner/request ID. The server computes the hash from canonical validated input; it does not trust a client hash. A matching retry returns the original entity, including if it was later confirmed or soft-deleted; a mismatching request is 409. Keep the identity on tombstones so replay cannot resurrect a deleted capture. Do not overload statement-import fingerprints. This is an execution receipt on the domain row, not another queue/table of commands [A5/A6; D11].

For nonrecurring items, parent, type details, alerts and prerequisites accepted by ERA commit atomically under the authenticated owner's authority. A failure rolls back all of them. Reuse the existing recurrence system outside this deliberately narrow path. **UNVERIFIED:** live item policies/function bodies; E-09c needs owner-generated current DB state before authoring security-sensitive SQL [A7/A9].

Offline eligibility is explicit: transaction draft create and, after atomicity, nonrecurring reminder/event create. Confirmation, transfer, debt settlement, recurrence changes and composite actions lacking atomicity keep an honest refusal. Queue cancellation before replay removes the pending operation; reversal after replay uses the owning module's existing inverse. Serialize cancellation against replay; never show an Undo action whose target is merely a vanished temporary ID.

## 4 · One fact contract, several surfaces

**DOCKS → E-04 / E-14 / E-20; packet E-04a.** Extend the planned typed signal input with `asOf`, owner/household scope, period, currency/unit and completeness (`complete | partial | unavailable`). Provenance remains table + IDs; only authorized records may contribute. Keep sensitive source details behind an existing detail affordance or owning-module door; no inline rationale paragraphs.

Reuse `src/lib/utils/incomeExpense.ts:369` (`sumSpending`), `src/features/recurring/commitments.ts:162` (`getRecurringCommitmentStatus`), billing dates in `src/lib/utils/date.ts`, and the existing schedule bundle's verified output. Do not aggregate raw widget totals or expand another RRule. Partial inputs can produce supported individual facts; they cannot support an “all clear,” available-to-spend amount, or complete-day assertion.

The same typed facts feed a deterministic answer, the stored briefing and the later Top View response. These are consumers, not independent calculators. E-14's RPC remains the planned network consolidation; its authorization and final shape require current owner DB evidence, not a copied stale SQL body. E-04 does not depend on building that new RPC first.

## 5 · Briefing delivery is a state machine, not an insert

**DOCKS → E-05 / E-06; packets E-05a–b.** Use the existing notifications store as the briefing identity: one user + eligible local date + briefing kind. Composition and delivery status are distinct. Store deterministic content before transport; claim the send atomically; retain failure/unknown state for recovery. An existing row does not mean successful delivery and must not suppress every retry [A12].

| Boundary | Evidence | What it proves |
|---|---|---|
| Computed | signals and deterministic compose fixture | Content is justified by the supplied facts |
| Stored | unique notification ID/group key | One logical briefing |
| Transport accepted | sender reports `sent > 0` for subscriptions | At least one push service accepted a send |
| Shown | device observation or implemented client acknowledgment | A particular phone displayed it |
| Opened / acted | authenticated interaction on that notification ID | An actual engagement, not silence interpreted as approval |

A DB unique constraint cannot make an external network send exactly once. Crash after transport acceptance and before DB update is an **unknown** outcome. Retry the same notification ID/tag with client dedupe, then prove one visible notification on each phone. Never promise mathematically exactly-once device delivery from `group_key` alone.

**DOCKS → E-03 / E-05 / E-16:** scheduler ticks UTC; recipient eligibility uses each user's IANA timezone, local date and configured hour. A five-minute polling interval fits the existing daily cron pattern; eligibility + claim handles duplicate ticks and DST. Partner inclusion begins after five owner-only mornings per D6, so the minimum hour/toggle and recipient path must precede E-16's later color work. Quiet-hours conflict C01 below blocks activation at 07:15; it does not justify silently inventing an exemption.

**DOCKS → E-07; packet E-07a.** Capture actual provider usage/model at the existing Gemini wrapper, preserve backward compatibility for existing text callers, and label estimates as estimates. Distinguish provider quota, feature allowance, network failure and disabled configuration. Quota reads/logging failures cannot be presented as unused allowance. Keep `ai_sessions/ai_messages` as the telemetry store, with no third counter product [A11; D4/D13].

## 6 · Treaty migration without changing the product's shape

**DOCKS → E-10 / E-13; packets E-10b and E-13a.**

1. Keep `/era` as assistant history and interaction. Hub Chat remains household messages and their existing message-to-module actions.
2. Expose the existing report generator and `AnalysisDashboard` within ERA; preserve authorized saved-report retrieval from `ai_messages`. Only then delete `AIChatAssistant.tsx` and its import/loader in `DeferredComponents.tsx` [A16].
3. E-13 needs an explicit turn host/persistence option. Current `useEraTurn` owns a conversation; passing `conversationId: null` is not its current API. Implement the adapter outside HubPage; the sanctioned HubPage edit installs it and deletes the superseded branch. No fourth store, duplicated action or duplicate assistant transcript.
4. `/chat` results are hub system messages per E-13, while `/era` persists in `era_*`. Treat this as the plan's explicit host projection, not a mandate to force all chat messages into both stores.
5. Preserve person identity, existing positions/animation and precise module doors. Remove a legacy assistant only after its reachable behavior has a tested owner [A16; C6; D4/D10].

**DOCKS → M-00; packet M-00a.** Delete proven-unused face widgets, `recipeOfferGenerate`, `stubIntentRouter`, `useEraHousehold` and unreachable color entries after a fresh reference search. Consolidate semantic face metadata while preserving existing visible labels and hues. `Face.route` deletion conflicts with E-20's proposed route source; explicit capability/card doors can own navigation without reviving the stale `/items` destination. No redesign accompanies deletion.

## 7 · Contradictions held for Phase 5

This is the Top Layer input to the final Contradiction Register, not permission to amend the active plan. No conflicting branch is implementation-ready until its resolution is recorded.

| ID / classification | Claim and source | Evidence / consequence | Recommended resolution |
|---|---|---|---|
| C01 · **CONFLICTS → D5** | E-05/HUB-42 promises 07:15; D5 prohibits nonexempt delivery before 08:00. E-19 implements policy only in Phase 3. | Master Plan §3 D5, §5 E-05/E-19. The first briefing cannot meet both requirements as written. | Keep D5 binding. Owner selects an eligible hour or explicitly authorizes a scheduled-digest exception; no 07:15 activation before this decision. Pull only the required delivery guard forward, with one shared policy function. |
| C02 · **DOCKS → E-03** | 04:15 UTC is treated as 07:15 Beirut. | E-03 uses a fixed cron hour; D6 requires each user's hour. Fixed UTC cannot encode both seasonal offsets. | Poll and select by IANA local time/date; DST and duplicate-tick fixtures. No offset constants. |
| C03 · **CONFLICTS → D6** | E-16 is Phase 2; partner starts on day 6 of Phase 1. | Master Plan phase table vs D6/E-16. | Bring recipient hour/toggle forward into E-05; leave visual color work in E-16. Record this sequencing correction. |
| C04 · **DOCKS → E-11 / E-05** | Trigger absence and missing intent CHECK are asserted; checklist puts trigger in E-11 while E-05 owns migration. | A9; stale snapshot predates current ERA tables. | Owner verifies first; E-05 owns any needed migration, E-11 owns behavior tests. Do not create a duplicate trigger spec. |
| C05 · **DOCKS → E-11** | Activity only logs reminders. | A8 proves broader deterministic coverage but narrow capability coverage. | Extend capability mapping; distinguish domain outcome from failed best-effort logging. |
| C06 · **DOCKS → E-01 / E-09** | Raw conversation GETs break the mutation rule; any catch is offline; an ID means durable queue. | A3–A5/A17. | Correct the comment, keep classification exact, prove IDB commit + replay reconciliation. |
| C07 · **DOCKS → E-05 / E-06** | A successful cron and deduped row prove “spoke first.” | A12 and plan G1. | Score transport and device evidence separately; count eligible local dates, not cron executions. |
| C08 · **DOCKS → E-07** | Summing existing token fields yields an accurate quota gauge. | A11. | Record actual provider usage/model or explicitly marked estimates; account for failed attempts/fallback. |
| C09 · **DOCKS → M-00 / E-20** | Delete `Face.route`; later obtain card doors from `faceRegistry`. | `faceRegistry.ts` declares unused route metadata; E-20 names it as the future source. | Use one explicit tested door owner; never keep dead metadata solely to satisfy a stale sentence. |
| C10 · **CONFLICTS → C6 / Hard Rule 14 implementation recipe** | E-16 infers person colors from viewer theme; colors must follow the person on both phones. | `ERA Notes/01 - Architecture/Color Identity.md` derives current/partner from viewer theme; frost/calm and independently chosen themes do not identify a person. | Owner confirms an existing persistent identity mapping or approves one. Test both viewers/themes before color rollout; do not guess identity from role. |
| C11 · **CONFLICTS → C6 / Hard Rule 15** | Existing floating surfaces already meet opaque theme rules. | `src/components/era/EraChatDrawer.tsx` uses an rgba sheet background. | New panels follow Hard Rule 15. Record existing styling debt; C6 does not authorize a restyle during another packet. |
| C12 · **DOCKS → E-01** | CI proves a running dev server serves the latest build (HUB-21). | Planned CI commands are typecheck/test/lint, not deployment or server-commit assertions. | Close the CI slice with CI evidence; keep served-build verification separate. No git writes in this study. |
| C13 · **DOCKS → E-09** | Draft storage/confirmation matches Drafts Overview. | A6/A7: actual rows and nontransactional confirmation differ; item writes can partly commit. | Correct the owning docs later; do not enable confirmation replay or atomicity claims until owning routes prove them. |
| C14 · **DOCKS → E-10 / E-15** | Offline reload will paint ERA from current persistence. | A13. | Persist only bounded briefing/topview keys with as-of state; no blanket transcript persistence. |
| C15 · **CONFLICTS → D7 capacity** | E-09's queue, income and events fit one bundled session. | A5–A7/A17 expose persistence, idempotency, atomicity and reconciliation prerequisites. | Split honestly. Use the plan's sacrifice order and owner gate protocol; do not preserve an impossible estimate by hiding reliability work. |
| C16 · **CONFLICTS → Hard Rule 1 literal scope** | Every toast requires Undo, including a nonmutating failure. | Hard Rule 1 vs the failure semantics in Experience §4: a rejected action has no inverse. | Keep real inverses for mutation acknowledgments. Owner clarifies the rule for nonmutating failures; never disguise Retry as Undo. |

## ASTRA 10× Findings

- **Leverage 1 — DOCKS → E-09/E-11:** one explicit outcome + stable request identity makes templates, offline capture, retries and Activity agree on what happened. It removes several independent opportunities to claim success without a durable write [A1–A8/A17].
- **Leverage 2 — DOCKS → E-04/E-14:** completeness-bearing facts can power reactive answers, Top View and deterministic briefings without three calculators. The existing schedule, spending and commitment substrates already supply the domain logic (§4).
- **Leverage 3 — DOCKS → E-05/E-06:** measure delivery at its real boundaries. Reusing a notification identity through retry and landing makes a failed morning diagnosable from the app [A12; §5].
- **Simplification — DOCKS → E-10/E-13:** retire the floating assistant and Hub AI branch only after report/history and host-projection parity. Delete duplicate assistant ownership, preserve household chat [A16; §6].
- **Frontier — NEW, parked:** use existing miss records, confirmed outcomes and feedback to build a small owner-reviewed regression corpus for evaluating router/template changes offline. No new live LLM or learning engine. Reopen only if 30 anonymized household cases demonstrate fewer routing corrections with zero unsafe actions; `missTracking.ts`, template tests and existing `ai_messages` provide the inputs. No production extraction authorized by this study.
- **Uncomfortable — CONFLICTS → D7 estimate:** the one-session offline feature is a distributed-write reliability project in disguise. Adding `addToQueue()` would inherit memory-only acknowledgments, duplicate-create risk and partial item writes [A5–A7/A17]. Shipping that shortcut would make ERA less trustworthy while its checklist became greener.

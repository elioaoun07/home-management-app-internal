---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit beb8584 (2026-11-04; application source identical to 22152c2, later commits added only docs/era-research/04 and 05). CURRENT IMPLEMENTATION unless labelled. No action, route, migration or test was executed."
---

# ERA Action Inventory

[README](README.md) · **Action Inventory** · [Action Lifecycle](ACTION-LIFECYCLE.md) · [Approval & Recovery Matrix](APPROVAL-AND-RECOVERY-MATRIX.md) · [Acceptance Scenarios](ACCEPTANCE-SCENARIOS.md)

What ERA can change today, through which path, and what each path already guarantees about interpretation, consent, duplicates, receipts and reversal. Important non-ERA mutation paths are included where ERA calls them or will need to. Gaps (`A-n`) feed the [lifecycle](ACTION-LIFECYCLE.md).

**Labels.** CURRENT IMPLEMENTATION = read in code. DOCUMENTED INTENT = vault/PM. PROPOSED = only in this folder's other files. UNKNOWN = needs the live DB, deployment flag, device or owner. ⛁ = needs a migration newer than the 2026-08-04 RLS snapshot.

## 0. Summary

1. **ERA acts through four paths that share adapters but not one lifecycle:** native resolver writes, native confirm cards, model-proposed registered plans (in memory by default, journalled behind a flag), and handoff to a precision form. A fifth, the offline queue, replays some of the same source routes later.
2. **The strongest guarantees are on the model path:** effective-value previews, consume-once confirmation, owner/chat/time binding, recheck before each write, "no artifact = uncertain", and an opt-in journal with attempt fencing that turns a timed-out write into *uncertain*, never a retry.
3. **Source routes decide whether a retry is safe, and most are not idempotent.** Client-id replay exists for transfers, bulk items, health measurements and fitness operations. Draft creation, shopping additions, recurring confirmation, debts and trip activation have no idempotency key.
4. **Undo exists only where an inverse is demonstrated:** soft-delete/restore entities (reminder, event, contact, place, draft, transfer) and a few native cards. Debts, memories, meal plans, shopping and updates have none (HUB-102).
5. **Several multi-row writes are not atomic** (trip activation, recurring confirm, draft confirm + balance, shopping add per item), so partial success is a real state that needs compensation, not only Undo.

## 1. How ERA reaches a write

| Path | Entry | Consent | Executor | Recovery | Code |
|---|---|---|---|---|---|
| **N1 Native act** | Router hit → `resolveIntent` → resolver | Speech-act gate; Act + Undo for low-effect classes | Resolver calls the source route | Toast Undo where inverse exists | `src/features/era/useEraTurn.ts`, `intents/resolveIntent.ts`, `intents/speechAct.ts` |
| **N2 Native confirm card** | Resolver returns `proposal.kind = "native_action"` | Tap Confirm on the card | `executeNativeAction` | Inverse built per type, run at most once (`once()`) | `src/features/era/nativeActions.ts:1-45` |
| **M1 Model plan (default)** | Router miss / Ask AI → `/api/era/ask` → validated `propose_action` / `propose_plan` | Confirm on the effective-action card for every write | `executePlan` in the browser | Stop at first non-done step; receipts per step | `src/lib/ai/eraAskProposal.ts`, `src/features/era/capabilities/plan.ts:201-430`, `useEraAskAI.ts` |
| **M2 Model plan (journal)** | Same, with `NEXT_PUBLIC_ERA_DURABLE_EXECUTION=true` ⛁ | Confirm recorded in `era_runs.state` | Client executes; server stores versioned transitions | Resume / Skip / Stop; `recover` after 120 s turns a running write into *uncertain* | `src/features/era/execution/state.ts:14-16, 235-330`, `src/app/api/era/runs/` |
| **H Handoff** | Tier `handoff` (income, split, many-field work) | The precision form's own Save | The form | The form's own | `src/features/era/engine.ts` (`income.record`, `split.create`), `useEraHandoff.ts` |
| **Q Offline replay** | A precision form or hook queued the mutation | The original tap | `offlineSyncEngine` on reconnect | `reviewRequired` fence for item creates and fitness only | `src/lib/offlineQueue.ts:12-38`, `src/lib/offlineSyncEngine.ts:199-247` |

Minimum tiers per capability (`MIN_TIER`, `src/features/era/engine.ts`): **act** — transaction.draft, reminder/event create, reschedule, complete, place, shopping.add, meal.assign, memory.save, result.amend; **confirm** — transfer.create, debt.record, draft.confirm, reminder.delete, reminder.series/occurrence/skip, recurring.cover; **handoff** — income.record, split.create. Model-interpreted writes are always Confirm (DEC-24; HUB-108).

## 2. ERA actions

| Action | Path | Source route | Idempotency | Receipt | Reversal | Notes |
|---|---|---|---|---|---|---|
| Spend draft (`transaction.draft`) | N1 | `POST /api/drafts` (`src/features/era/useEraBudgetSubmit.ts:174`) | None: no client id (`src/app/api/drafts/route.ts:69-79`) | Draft id + artifact | Undo: draft soft-delete | Retry after lost response can create two drafts (HUB-46) |
| Confirm draft (`draft.confirm`) | N2 / M1 | `PATCH /api/drafts/[id]` | Conditional update `is_draft = true` acts as a CAS (`drafts/[id]/route.ts:50-64`) | Transaction | **No Undo** ("changed" in Artifacts status) | Second confirm fails with 500, indistinguishable from a real failure; balance adjust runs after the update, not in one transaction (`:81-85`) |
| Transfer | N2 | `POST /api/transfers` | **Client id** = idempotency key; 23505 → replay of committed row (`transfers/route.ts:33-36, 367-368`) | Transfer id | Undo: `DELETE /api/transfers/[id]` soft-deletes and reverses balances once | Best-shaped money path |
| Record debt | N2 | `POST /api/debts` | None | Debt id | Undo = hard delete (no Redo) | Compensation-like inverse |
| Cover recurring | N2 | `POST /api/recurring-payments/[id]/mark-covered` | None; no claim on due date | Advances `next_due_date` | `undoCoverRecurring` | — |
| Log recurring payment | Form/Q (ERA hands off) | `POST /api/recurring-payments/[id]` creates transaction, adjusts balance, advances due date; advance failure "not critical" (`route.ts:144-282`) | None; offline confirm is queued and replayed without a review fence (`useRecurringPayments.ts:316-330`; `offlineSyncEngine.ts:201-203`) | Transaction | None | Double posting possible (M2, 19-business-rules) |
| Create reminder / event | N1 / M1 | `POST /api/items` → `create_item_complete` (one SQL call) ⛁ | Optional `id` in the contract (`src/lib/items/createContract.ts:22`); offline create fenced with `reviewRequired` | `completion: not_started / complete / unknown`; unknown → "Save unverified. Check Schedule before retrying." (`src/app/api/items/route.ts:11-35`) | Undo: soft delete | SCH-24 receipts; Google backup outside the receipt |
| Reschedule / complete one-time reminder | N1 / M1 | `PATCH /api/items/[id]`, `POST /api/items/[id]/complete` | Complete upsert by occurrence (`items/[id]/actions/route.ts:106`) | Artifact | Reschedule Undo = previous `due_at`; complete: none listed | Live target revalidated before write (HUB-108) |
| Delete reminder | N2 / M1 | `DELETE /api/items/[id]` | Soft delete | Artifact | Undo: `POST /api/recycle-bin/restore` | Destructive flag |
| Series / occurrence edits, skip | N2 | Schedule routes | — | Artifact | Series: previous `due_at`; occurrence/skip: none ("No demonstrated inverse", `nativeActions.ts:187`) | Recurrence on the model path is refused (HUB-108 item 5) |
| Add shopping items | N1 / M1 | `POST /api/hub/messages`, **one request per item** with progress checkpoints and `partial: true` (`src/features/era/intents/resolvers/shopping.ts:80-100`) | None: no client id in the message schema (`src/app/api/hub/messages/route.ts:20-31`) | Message ids | None (HUB-102) | Fan-out per row (Doctrine: "a write that fans out is a bug", HUB-116) |
| Shopping rename/qty/move/remove, group create | N1 / N2 | Hub routes | None | Artifact | Group create: Undo; remove: none | — |
| Assign meal (`meal.assign`) | N1 / M1 | `POST /api/meal-plans`; an occupied slot is **updated in place** (`src/app/api/meal-plans/route.ts:140-170`) | Slot-keyed upsert | Artifact | None; the replaced recipe is not kept (HUB-102) | Card shows "Replace occupied slot / Both" |
| Save note (`memory.save`) | N1 / M1 | `POST /api/memories` → `household_memories` (absent from schema) | Duplicate label → 409 | Artifact | None | 04-memory-context G5 |
| Contact / place | N1 | `POST /api/catalogue/items` (+ module create on first place) | None | Artifact | Undo: soft delete | Places module created once (`settings_json.era_role`) |
| Event place / time follow-ups | N1 | `PATCH /api/items/[id]` (resends `start_at`/`end_at`) | — | Artifact | — | HUB-94 gotchas |
| NFC reminder | M1 (`propose_nfc_reminder`) | Item + trigger writes | None | Partial facts kept: reminder recorded, trigger "unverified" (HUB-108 item 4) | Reminder soft delete | Outside the journal |
| Lexicon rule | N1 | `POST/DELETE /api/era/lexicon` ⛁ | One live default (partial unique index) | None by design | "Forget" revokes | Not app data |
| Report a turn | UI | `POST /api/era/issues`; Undo `DELETE /api/era/issues/[id]` | — | System row | Undo | Imported to PM files (04-memory-context §5) |

## 3. Other important mutation paths

| Module | Path | Atomic? | Idempotent? | Precondition / concurrency | Reversal | Code |
|---|---|---|---|---|---|---|
| Transactions | Expense form create (queued offline) | Balance via `adjustAccountBalance` choke point | No client id | — | Delete → soft delete + balance reversal | Feature Map transactions |
| Schedule | `POST /api/items/bulk` (SCH-25) | One request | **Client ids** per item | — | Soft delete | `src/app/api/items/bulk/route.ts:1-3` |
| Schedule | `POST /api/items/bulk/complete` | One request | Upsert item + occurrence + type | — | — | `items/bulk/complete/route.ts:2` |
| Healthcare | `health_save_medication()` | One transaction (items + medication) | — | — | — | `src/app/api/healthcare/medications/route.ts:19` |
| Healthcare | Measurements | — | **Client id** replay returns stored row | — | — | `healthcare/measurements/route.ts:60` |
| Healthcare | PRN dose log | — | Unique (medication, day, slot) | — | — | `schema.sql` `health_medication_logs_prn_slot_unique` |
| Fitness | Session / set operations | — | **`fitness_operations.op_id`** ledger; queued replays kept for review on 4xx | — | — | `schema.sql` `fitness_operations`; `offlineSyncEngine.ts:309-325` |
| Catalogue | `PATCH /api/catalogue/items/[id]` | — | — | **`expected_revision` → 409 `stale_revision`** ⛁ | — | `src/app/api/catalogue/items/[id]/route.ts:58, 107-117` |
| Trips | `POST /api/trips/[id]/activate` | **No**: account insert, category loop, balance row, cascade RPC (gated by `TRIP_CASCADE_ENABLED`), then status update; account deleted only when the RPC fails | Guard only `status = active` → 409 | Dates required | Manual compensation | `src/app/api/trips/[id]/activate/route.ts:14-126` |
| Trips | `complete_trip` RPC | RPC | — | — | `trip_side_effects.previous_value` recorded | `trips/[id]/complete/route.ts:37` |
| Meal Planning | Add to shopping | Sets `status = shopping_added` | — | — | — | `src/app/api/meal-plans/add-to-shopping/route.ts:126` |
| Recycle Bin | Restore | Restores row and re-applies balance | — | Row must be trashed | Delete again | Feature Map recycle-bin |
| NFC | `POST /api/nfc/[slug]/tap` | Flips state, evaluates prerequisites | — | — | — | `src/app/api/nfc/[slug]/tap/route.ts:10-11` |
| Integration: Google Calendar | `syncItemToGoogleCalendar` after item writes; daily reconcile | Best effort, **outside** the source receipt | Idempotent upsert on reconcile | — | Reconcile deletes stale events | `src/lib/gcal/sync.ts:1-13`; `src/app/api/cron/gcal-reconcile/route.ts:1-10` |
| Integration: push, preferences, calendar connect | Subscribe/unsubscribe, preferences PATCH, OAuth callback | — | — | — | Reconnect / toggle | `src/app/api/notifications/*`, `src/app/api/gcal/*` |

## 4. Lifecycle mechanisms that already exist

| Stage | Mechanism | Where |
|---|---|---|
| Interpretation | Deterministic router first; `clarify` for ambiguous; speech-act gate refuses negated/hypothetical/reported writes | `intents/index.ts`, `intents/speechAct.ts` |
| Target resolution | Focus memory with 30-min TTL; `FOCUS` sentinel; registered lookups; "never guess across a tie" | `focusMemory.ts`, `capabilities/registry.ts` (`entityRefSlot`) |
| Preview | Effective-action card from registry fields and parsed slots, not model prose (HUB-109) | `capabilities/preview.ts:1-31`, `effectiveAction.ts` |
| Authorization | Consume-once confirmation (`takeProposalForConfirmation`) | `capabilities/confirmation.ts:1-12` |
| Binding | Cards bound to owner, conversation, time and zone; New chat suspends dispatch | HUB-108 item 1; `useEraAskAI.ts` |
| Input change | `beforeWrite` re-reads sources, compares with `sameAction`; a difference returns "Confirm the effective action." and dispatches nothing | `effectiveAction.ts:24-35`; `plan.ts:336-352` |
| Execution | At most six steps; preflight every consumer of a step's output before later writes | `plan.ts:14, 365-375` |
| Verification | A write step with no artifact becomes *uncertain* ("Couldn't verify that action. Check the app before retrying.") | `plan.ts:376-389` |
| Outcome vocabulary | `answered, done, drafted, needs_input, awaiting_confirm, queued, uncertain, failed, partial, handed_off` | Top Layer §4 row 8; `plan.ts:169-190` |
| Durable progress | Versioned run state, CAS, `attemptId` fencing, 120 s attempt timeout, Resume/Skip/Stop, recover → *uncertain* for writes | `execution/state.ts:16, 235-330` |
| Cancellation | Cancel rejected while a write attempt is younger than 120 s; afterwards a running step becomes *uncertain* | `state.ts:249-262` |
| Source receipts | Items `completion` status; unknown → "Check Schedule before retrying" | `src/app/api/items/route.ts:11-35` |
| Reversal | Undo/Redo derived from the row's live status (`live/trashed/changed/gone`) | `src/app/api/era/actions/status/route.ts:1-8`; `src/lib/era/artifacts.ts:163-170` |
| Offline | Timeouts never queue; item creates fenced `reviewRequired` before dispatch | `Sync and Offline.md`; `offlineSyncEngine.ts:241-247` |

## 5. Patterns worth reusing from the Delivery engine

Only patterns are relevant; Delivery acts on code, not household data.

| Pattern | Delivery evidence | ERA use |
|---|---|---|
| Pure transition table that throws on an illegal event | `scripts/delivery/state-machine.mjs:1-8` | One action state machine for N1/N2/M1/M2 (ERA's `execution/state.ts` already follows it) |
| Hard-coded human gates that cannot be configured off; typed approval for risk flags (`db-migration`, `security`) | `state-machine.mjs:28-35, 63` | Money movement, deletes and outward actions are fixed Confirm gates no setting can remove |
| Owner controls drained only at boundaries (pause, cancel, change) | `scripts/delivery/controls.mjs:1-14` | Cancel takes effect between steps, never mid-request |
| Snapshot fingerprints to detect that approved state changed | `run-session.mjs` `fingerprintDirtyPaths` (`:1526-1555`) | Approval fingerprint over effective values and source revisions |
| Attributed, versioned ledger whose decisions are never compacted | `scripts/delivery/memory.mjs:1-26` | Action receipts keep who approved what, and when |

## 6. Gaps

| ID | Gap | Evidence |
|---|---|---|
| A-1 | Four consent/recovery behaviours: native acts, native cards, default model plans and journalled plans differ | §1; HUB-46 final-review boundary |
| A-2 | Most source writes have no idempotency key, so a lost response makes the outcome unknown and a retry unsafe | §2, §3 |
| A-3 | Non-atomic multi-row writes: trip activation, recurring confirm, draft confirm + balance, shopping per item | §2, §3 |
| A-4 | Missing inverses for debts (hard delete), memories, meal-slot replacement, shopping, updates and occurrence edits | §2; HUB-102 |
| A-5 | Recurring confirm has no claim on the due date and is replayed offline without a review fence | §2; M2 |
| A-6 | Draft confirm's second attempt returns 500 instead of "already confirmed" | §2 |
| A-7 | Native cards are outside the journal; their approval has no stored fingerprint or expiry | §1; HUB-46 |
| A-8 | The journal is off by default and depends on unapplied-or-unknown migrations | `state.ts:14`; HUB-104 rollout gates |
| A-9 | Integration side effects (Google backup) are outside receipts; failure is invisible to the action | §3 |
| A-10 | No general "status read" exists for most writes, so *uncertain* can only say "check the app" | `actions/status` covers artifacts with bins only |

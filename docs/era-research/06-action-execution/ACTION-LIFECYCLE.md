---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit beb8584 (application source identical to 22152c2). 'Today' cells are CURRENT IMPLEMENTATION (see ACTION-INVENTORY.md); rules, envelope, states and examples are PROPOSED DESIGN. Examples use fictional data (Maya and Sami, Asia/Beirut, November 2026). No action was executed."
---

# ERA Action Lifecycle

[README](README.md) · [Action Inventory](ACTION-INVENTORY.md) · **Action Lifecycle** · [Approval & Recovery Matrix](APPROVAL-AND-RECOVERY-MATRIX.md) · [Acceptance Scenarios](ACCEPTANCE-SCENARIOS.md)

One lifecycle for every ERA write, whichever path starts it: interpret → resolve → check preconditions → preview → authorize → execute → receipt → verify, with cancellation and recovery defined at each boundary. Rules are `LC-n`; gaps `A-n` are in the [inventory](ACTION-INVENTORY.md#6-gaps); per-action settings are in the [matrix](APPROVAL-AND-RECOVERY-MATRIX.md).

## 0. Summary

- **Converge, don't replace.** The model path already has the right pieces (effective preview, consume-once Confirm, binding, recheck before write, artifact-or-uncertain, journal with attempt fencing). The design gives native acts and native cards the same envelope and states, and gives source routes one idempotency key.
- **Unknown is a first-class outcome.** A lost response is *uncertain* until a status read proves otherwise. ERA retries a write automatically only where the source replays by the same key.
- **Approval binds to what was shown.** It expires on time, day change, owner/chat change or any change to an input it was based on; a stale approval re-previews, never executes.
- **Undo restores; compensation offsets.** Undo appears only where an exact inverse exists and the row is still as ERA left it. Everything else gets a compensating action with its own preview and Confirm.

## 1. Owner controls this design preserves

| Control | Source |
|---|---|
| Money movement, deletes, series edits and draft confirmation are Confirm; model-interpreted writes are Confirm | Top Layer §5; `engine.ts` `MIN_TIER`; DEC-24 |
| AI proposes, the person confirms; no direct model write to money or schedule | CLAUDE.md Domain Gotchas; Design Doctrine §4 |
| Every ERA write leaves an Artifact | Owner rule 2026-10-04 |
| Every toast has Undo; Undo only where an inverse is demonstrated | Hard Rule 1; Top Layer §5 |
| No new offline queue; timeouts never mark offline or enqueue | D11; Hard Rule 6 |
| Hot writes through choke points (`adjustAccountBalance`, `safeFetch`) | Design Doctrine §4 |
| No agent writes to production; delivery gates cannot be configured off | Hard Rule 26; `scripts/delivery/state-machine.mjs:28-35` |

## 2. The action envelope

Every write ERA attempts has one record (in the journal for Confirm-tier actions and plans; in the transcript payload for Act-tier actions):

| Field | Meaning |
|---|---|
| `action_id` | Client-generated UUID, created at preview; the source's idempotency key where supported (LC-14) |
| `capability`, `effect_class`, `tier` | From the registry and `MIN_TIER`; escalators may raise the tier |
| `owner`, `conversation`, `device` | Bound at creation (CURRENT: owner/chat binding, HUB-108) |
| `anchor` | Request time, local date and IANA zone; relative dates never move on resume (CURRENT journal `referenceDate`, `timeZone`) |
| `effective_values` | Exactly what the adapter will send (CURRENT `EffectiveAction`) |
| `preconditions` | Each with the version observed: target `updated_at`/`revision`, `is_draft`, occurrence, `next_due_date`, balance `balance_set_at` / last history row, list membership |
| `fingerprint` | Hash of capability + effective values + precondition versions + owner + conversation + anchor |
| `approval` | `{by, device, at, fingerprint, expires_at}` or `standing_rule_id`; consumed once |
| `attempts` | `{attempt_id, started_at, ended_at, result}` (CURRENT journal `attemptId`, 120 s) |
| `outcome` | `not_started · done · failed · uncertain · partial · cancelled · expired` (plus the existing `answered, drafted, needs_input, awaiting_confirm, queued, handed_off`) |
| `receipt` | Source completion, artifacts, and `previous` values needed for an inverse |
| `reversal` | `undo` (handle) · `compensation` (template) · `none` |
| `links` | `compensates` / `compensated_by` another `action_id` |

## 3. States

```
proposed ──► previewed ──► approved ──► dispatching ──► committed ──► verified ──► (undone | compensated)
   │            │             │              │               │
   │            │             │              ├──► rejected (not_started: validation, 4xx, offline before send)
   │            │             │              └──► unknown ──► reconciled (done | not_started) | handed to the person
   │            │             └──► stale ──► re-previewed
   │            └──► expired / cancelled (nothing happened)
   └──► refused (speech act, unsupported, ambiguous target → question)
```

| Proposed state | Existing journal status | Outcome shown |
|---|---|---|
| previewed / approved | `awaiting_confirm`, `waiting`, `queued` | Card / "Confirm the effective action." |
| dispatching | `running` (with `attemptId`) | Thinking dots |
| committed + verified | `done` | Receipt with Undo when available |
| rejected | `blocked` | "Didn't go through" + reason |
| unknown | `uncertain` | "Check [Open]" |
| some steps done | `partial` | Per-step receipts |
| cancelled / expired | `cancelled` | Nothing, or "Stopped" |

## 4. Stages

### 4.1 Interpret

| Rule | |
|---|---|
| **LC-1** | A sentence yields parts; each part becomes at most one action. An unsupported part is named, never silently dropped (CURRENT prompt rule, `eraAskProposal.ts` contract). |
| **LC-2** | Only committed instructions create actions. Negated, hypothetical, reported, conditional-on-the-unsupported and merely informational sentences create none (CURRENT `intents/speechAct.ts`; HUB-108 item 6). |
| **LC-3** | A model's output is a proposal. Admission validates capability, slots and plan shape before any preview (CURRENT `validatePlan`, Zod). |

### 4.2 Resolve targets

| Rule | |
|---|---|
| **LC-4** | Every existing-entity slot is resolved by a registered lookup or a live focus entity; a tie or a miss asks one question; no nearest match (CURRENT `entityRefSlot`, `resolveFocusRef`; HUB-64). |
| **LC-5** | The version of each resolved target is captured into `preconditions` at resolution time. |

### 4.3 Preconditions

| Rule | |
|---|---|
| **LC-6** | Each capability declares its preconditions: visible and owned (or permitted); state (open, not trashed, draft still a draft, one-time not recurring); version; money: same currency, account active and visible; schedule: anchor date. |
| **LC-7** | Preconditions are checked at preview and again immediately before dispatch (CURRENT on the model path via `beforeWrite` + `sameAction`, `plan.ts:336-352`). Native cards adopt the same recheck (A-7). |

### 4.4 Preview

| Rule | |
|---|---|
| **LC-8** | The preview shows the effective values the adapter will send, derived deterministically (CURRENT HUB-109), plus the effect when it is not obvious (`Recycle Bin`, `Replaces Burger night (Sami)`) and the reversal kind as one word (`Undo` / `Can't undo`). Hard Rule 28 applies. |
| **LC-9** | The preview computes the fingerprint (§2). Two previews with the same fingerprint are the same action. |

### 4.5 Authorize

| Rule | |
|---|---|
| **LC-10** | Minimum tier from `MIN_TIER`; escalators (default or low-confidence binding, inferred currency, partner-owned target, recurring scope, alert already sent) raise it; nothing lowers it. Model-interpreted writes are Confirm. |
| **LC-11** | An approval records `{by, device, at, fingerprint, expires_at}` and is consumed once (CURRENT `takeProposalForConfirmation`). |
| **LC-12** | An approval is **stale** at the earliest of: its expiry (XD-1: 30 min; money 15 min); a local-day change when relative dates were used; New chat, owner switch or sign-out; any change to a precondition version. |
| **LC-13** | A standing authorization ("Always", from [05 AR-12b](../05-proactive-assistance/ATTENTION-RULES.md#10-levels-effects-and-receipts--ar-12-ar-13)) covers only Act-tier, reversible actions in its declared scope; never Confirm-tier. |

### 4.6 Execute

| Rule | |
|---|---|
| **LC-14** | The source receives `action_id` as its idempotency key where it supports one (CURRENT: transfers, bulk items, measurements, fitness `op_id`; item create accepts `id`). Every other source is marked **unsafe to retry** in the matrix until it supports one (A-2). |
| **LC-15** | One writer per action: the journal's CAS + `attemptId` for Confirm-tier actions and plans (CURRENT M2); an in-memory lock per `action_id` for Act-tier. |
| **LC-16** | Several rows are one request (HUB-116) or declared plan steps with per-step receipts; no silent loops (A-3; CURRENT shopping loop reports `partial`). |
| **LC-17** | Cancellation happens only at boundaries: before dispatch (nothing happened); between steps (stop; finished steps keep their receipts and reversal); never during a request in flight. A write attempt older than 120 s can be stopped and becomes *uncertain* (CURRENT `state.ts:249-262`). |

### 4.7 Receipt

| Rule | |
|---|---|
| **LC-18** | A receipt is the source's answer: completion status, artifact ids, `previous` values for an inverse. Prose is never a receipt (CURRENT). |
| **LC-19** | A write with no artifact and no explicit source completion is *uncertain* (CURRENT `plan.ts:376-389`). |

### 4.8 Verify

| Rule | |
|---|---|
| **LC-20** | Verification is the source's own completion (`completion: complete`) or a status read of the artifact (`POST /api/era/actions/status`, `live/trashed/changed/gone`). |
| **LC-21** | Money actions verify that the balance change was recorded (the balance-history entry for the transaction/transfer), per `money-rules`; a missing entry makes the action *partial*. |
| **LC-22** | Integration side effects (Google Calendar backup, push) are verified separately and reported as "Calendar backup pending", never as the action's outcome (CURRENT: backup outside the receipt, `src/app/api/items/route.ts:31`). |

### 4.9 Cancel

Covered by LC-17. A cancelled action that already committed is not "cancelled": it is *done* and offers its reversal.

### 4.10 Recover

| Rule | |
|---|---|
| **LC-23** | **not_started** (validation, 4xx, known offline before dispatch): safe to edit and retry with the same `action_id`. |
| **LC-24** | **unknown** (timeout after dispatch, 5xx, lost response, app closed while running): state *uncertain*; ERA never retries automatically unless the source replays by `action_id`, and then once (XD-2). Otherwise `[Check]` performs a status read: found → *done* with the discovered artifact; absent → `[Try again]` with the same `action_id`; inconclusive → open the module. |
| **LC-25** | **partial**: each step keeps its state; finished steps keep reversal; the failed step is retryable only if *not_started*; later steps stop; the person chooses Resume / Skip / Stop / Undo finished steps (CURRENT journal commands). |
| **LC-26** | **Compensation** is a new action with its own preview, Confirm and receipt, linked by `compensates`. ERA proposes it; it never runs automatically. |

## 5. Hard cases

| Case | Rule |
|---|---|
| **Repeated request** | **LC-27.** Same fingerprint twice: a double tap is consumed once (LC-11); a second identical *create* in the same conversation within 60 s gets one chip `Add another? [Yes] [No]` instead of a silent duplicate; two devices compete through the journal CAS (one wins, the other sees "Execution changed. Refresh and resume.", CURRENT `state.ts:248`). |
| **Retry** | **LC-28.** Retries reuse the `action_id`. A retry of a *done* action returns its receipt; of *uncertain* goes through LC-24; of *not_started* re-runs preconditions first. |
| **Timeout, unknown outcome** | LC-24. The message is `Check [Open]`; never "Failed" (which invites a retry) and never "Done". |
| **Partial success** | LC-25; the receipt lists done, failed and not-started parts, each with its own reversal. |
| **Interruption** | **LC-29.** Reload, app close, New chat, account switch: journalled actions resume only on explicit Resume in the original conversation (CURRENT); without the journal (default today, A-8), an in-flight write is unknowable after reload, so ERA shows the last receipt and the artifacts it has and asks the person to check. New chat and owner switch suspend dispatch; acknowledged effects keep their artifacts (CURRENT HUB-108). |
| **Stale approval** | **LC-30.** A stale approval (LC-12) produces a fresh preview with changed fields marked; nothing is sent. |
| **Inputs changed before execution** | **LC-31.** At the pre-dispatch recheck: a changed version → re-preview showing old → new (CURRENT for model path: "Confirm the effective action."); target gone or trashed → stop with `No longer exists`; money input changed (balance, currency, account visibility) → re-preview even if the values the card shows did not change. Catalogue writes send `expected_revision` and treat 409 `stale_revision` as stale (CURRENT ⛁). |

## 6. Undo versus compensation

| Kind | Definition | Allowed when | Examples (CURRENT unless noted) |
|---|---|---|---|
| **Undo** | The app's own inverse that restores the prior state exactly | An inverse is demonstrated **and** the row's live status is still what ERA left (`live` for created, `trashed` for deleted) | Reminder/event/contact/place/draft delete ↔ restore; transfer soft-delete with balance reversal; reschedule back to previous `due_at`; shopping group create; recurring cover (`undoCoverRecurring`) |
| **Compensation** | A new forward action that offsets an effect that cannot be removed or that others have built on | No inverse exists, the row has changed, or the effect left the app | Delete a duplicate recurring transaction (M2); re-assign the meal a slot replacement overwrote (needs the stored previous recipe, PROPOSED); remove shopping rows already seen by the partner; delete a trip account and its seeded categories after a failed activation; re-create a hard-deleted debt; "un-skip" an occurrence through Schedule |
| **None needed** | Reads; idempotent replays; integration backups healed by reconcile | — | `schedule.forDay`; Google backup drift (daily reconcile) |
| **Irreversible** | Effects outside the app | Shown as `Can't undo` before Confirm | A push already delivered; anything a person has already acted on |

**LC-32.** Undo is offered from the receipt and from Artifacts, derived from live status (CURRENT `actions/status`). When Undo is not possible the receipt says nothing extra; the Artifacts row offers `[Fix]`, which previews the compensation.

## 7. Three cross-module examples

### E1 — Recipes → Meal Planning → Shopping

**Request.** Maya, Wed 4 Nov 18:00: *"Plan mujaddara for Friday dinner and add what we need."*

| # | Step | Tier | Preconditions captured | What happens | Reversal |
|---|---|---|---|---|---|
| 1 | `recipe.search` "mujaddara" | Read | — | One match (ID from the read, never from the model) | — |
| 2 | `meal.assign` Fri 6 Nov dinner | Confirm (model plan) → **escalated** | Slot Fri/dinner occupied by "Burger night", assigned by Sami | Preview: `Fri dinner · Mujaddara · Replaces Burger night (Sami)` | **Compensation** (slot updated in place; previous recipe not kept today) |
| 3 | `recipe.ingredients` | Read | Recipe id from step 1 | 5 ingredients | — |
| 4 | `shopping.add` 5 items to Household list | Confirm | List membership: none of the 5 present at preview | Items sent one per request (today) | **Compensation** (no inverse, HUB-102) |

**What goes wrong and how the lifecycle answers.**
- *Inputs change:* at 18:03 Sami adds "onions" by hand. The pre-dispatch recheck of step 4 sees list membership changed → re-preview `4 items (onions already on the list)` (LC-31).
- *Timeout:* item 3 of 4 times out. Items 1–2 *done* (artifacts), item 3 *uncertain*, item 4 *not_started*; run *partial* (CURRENT shopping progress checkpoint). `[Check]` reads the list: item 3 present → *done*; then `[Resume]` sends item 4 (LC-24, LC-25).
- *Repeat:* Maya says the same sentence again at 18:05 → same fingerprint for step 2 (already done) → `Already planned · Fri dinner [Open]`; step 4 items already present → nothing to add (LC-27).
- *Reversal:* Maya taps Undo on the receipt. The meal slot shows `[Fix]` → compensation preview `Fri dinner · Burger night (restore)` built from the receipt's stored `previous` (PROPOSED field); the shopping lines show `[Remove 4]` → compensation through the existing remove card. Nothing is reverted automatically.

### E2 — Transfers → Recurring → Accounts (money)

**Request.** Sami, Wed 4 Nov 09:00: *"Move 200 from Drawer to Wallet and mark the internet bill covered."*

| # | Step | Tier | Preconditions captured | Idempotent? | Reversal |
|---|---|---|---|---|---|
| 1 | `transfer.create` Drawer → Wallet $200 | Confirm always | Drawer balance $310 (last history entry #h1), both USD, both visible | **Yes** (client id) | **Undo** (soft delete + balance reversal) |
| 2 | `recurring.cover` Internet $45 | Confirm always | `next_due_date` = Sat 7 Nov, active | **No** | Undo (`undoCoverRecurring`) while unchanged |

**What goes wrong and how the lifecycle answers.**
- *Stale approval:* Sami opens the card and leaves. At 09:20 Maya logs $150 from Drawer (history #h2). At 09:25 Sami taps Confirm: the money approval expired at 09:15 (XD-1) and a precondition changed → re-preview `Drawer $160 → −$40 after transfer` (LC-12, LC-30). Sami changes the amount to $100 and confirms.
- *Timeout with unknown outcome:* the transfer POST times out. Transfers replay by client id, so ERA re-sends once with the same `action_id` and receives the already-committed row → *done* (LC-24; CURRENT `transfers/route.ts:367-368`).
- *Second timeout:* the cover POST times out. No idempotency → *uncertain*; `[Check]` reads the recurring payment: `next_due_date` is now 7 Dec → reconciled *done*. Had it still been 7 Nov, `[Try again]` would be offered, never automatic.
- *Duplicate effect from elsewhere:* the same morning Sami also confirmed Internet in the Recurring page, which the route allows twice (M2). ERA's status read shows two transactions for one due date → `[Fix]` proposes compensation `Delete duplicate Internet $45 · 4 Nov` (soft delete with balance reversal), Confirm required (LC-26).
- *Undo:* transfer Undo stays available while the transfer row is `live`; after Maya edits that transfer in Transfers, status becomes `changed` and the Undo disappears (CURRENT derived status).

### E3 — Trips → Schedule/Chores → Google Calendar

**Request.** Maya, Mon 9 Nov 20:00: *"We're off to Lisbon Thursday to Monday — activate the trip, skip my chores while I'm away and move the dentist to the 18th."*

| # | Step | Path today | Tier | Preconditions | Reversal |
|---|---|---|---|---|---|
| 1 | Activate trip "Lisbon" 12–16 Nov | **Handoff** (no ERA trip capability) | Handoff → Trips page Save | Trip `status = upcoming`, dates set | **Compensation**: activation is not atomic (`src/app/api/trips/[id]/activate/route.ts:34-126`) |
| 2 | Skip Maya's 3 chore occurrences in 12–16 Nov | N2 `reminderSkip` per occurrence | Confirm | Each occurrence still open; trip cascade (`TRIP_CASCADE_ENABLED`) off | **Compensation**: no inverse for occurrence skips (`nativeActions.ts:187`) |
| 3 | Move "Dentist" to Wed 18 Nov, keep 10:00 | M1 `reminder.reschedule` | Confirm | Item open, one-time, `updated_at` v1 | **Undo** (previous `due_at`) |
| 4 | Google Calendar backup of step 3 | Side effect | — | Connection active | None needed (reconcile) |

**What goes wrong and how the lifecycle answers.**
- *Cross-path plan:* step 1 opens Trips; the run waits in `handed_off`; on return ERA reads the trip: `active` → continues with steps 2–3; still `upcoming` → asks `Activate first? [Open Trips] [Continue anyway]`.
- *Partial activation:* the trip status update fails after the account and categories were created. A second Save would create a second trip account (the guard checks only `status = active`). ERA's read after handoff shows `upcoming` plus a new account named for the trip → `[Fix]` proposes `Remove empty trip account "Lisbon"` before re-activation (LC-26). Making activation one RPC is XD-7.
- *Inputs change:* at 20:02 Sami moves the dentist to 17 Nov 09:00 from Sami's phone (v2). Step 3's recheck sees v1 ≠ v2 → re-preview `Dentist · was 17 Nov 09:00 (moved by Sami) → 18 Nov 10:00` (LC-31; partner-changed target escalates per LC-10).
- *Interruption:* Maya closes the app after the first chore skip. With the journal on, the run reopens in the same conversation: `1 of 3 skipped · [Resume] [Stop]` (CURRENT M2). With it off, the receipt row for the first skip exists and the rest must be re-requested.
- *One producer per fact:* if the trip cascade is enabled later, it skips chores itself; ERA then drops step 2 instead of skipping twice.
- *Integration:* the Google backup for step 3 fails. The reschedule is *done*; the receipt adds `Calendar backup pending`; the daily reconcile heals it (LC-22).

## 8. Owner decisions

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| XD-1 | Approval lifetime | 30 min all · money 15 min · until day change only | 30 min; money 15 min; always void on bound-input change |
| XD-2 | Automatic single replay after a timeout | Never · only for sources that replay by key | Only for keyed sources (transfers, bulk items, measurements, fitness), once |
| XD-3 | Recurring-payment claim on (payment, due date) | Keep · add claim (migration) | Add before ERA offers recurring log/cover from proposals at scale (M2) |
| XD-4 | Client ids for drafts and shopping messages | Keep · add (migration) | Add; they are the commonest ERA writes (HUB-46) |
| XD-5 | Durable journal rollout | Keep off · owner applies migrations then enables | Enable after HUB-104 gates; it is the only cross-reload recovery |
| XD-6 | Native confirm cards into the journal | Keep separate · converge | Converge (HUB-46 boundary) |
| XD-7 | Trip activation atomicity | Keep multi-step · one RPC | One RPC with idempotent account creation; DEC-04 for reversal |
| XD-8 | Approve on one device, confirm on another | Disallow · allow same owner | Allow (journal already arbitrates) |
| XD-9 | Store `previous` values for in-place updates (meal slot, updates) | Keep · store in receipt | Store; prerequisite for HUB-102 inverses |

## 9. Not proposed

Automatic compensation; retries of unkeyed writes; an ERA-specific offline queue; arbitrary endpoint execution by the model; widening the Act tier; executing anything from this folder.

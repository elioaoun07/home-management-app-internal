---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit beb8584 (application source identical to 22152c2). PROPOSED acceptance set; nothing was executed. All people, records, amounts and dates are fictional (Maya and Sami, Asia/Beirut, November 2026)."
---

# ERA Action Acceptance Scenarios

[README](README.md) · [Action Inventory](ACTION-INVENTORY.md) · [Action Lifecycle](ACTION-LIFECYCLE.md) · [Approval & Recovery Matrix](APPROVAL-AND-RECOVERY-MATRIX.md) · **Acceptance Scenarios**

Scenarios that a converged action lifecycle must pass. Each names its rules (`LC-n`, `AP-n`) and the example it belongs to (E1–E3 in [ACTION-LIFECYCLE §7](ACTION-LIFECYCLE.md#7-three-cross-module-examples)).

## 1. How to run without executing actions

- **Pure transitions.** `transition(state, command, now)` in `src/features/era/execution/state.ts` is already pure; new states and commands get table tests in the same style.
- **Fake sources.** Adapters run against a fake `safeFetch` that can return success, 4xx, 5xx, timeout-after-commit and timeout-before-commit, and that records every request. No real route, database or device is called.
- **Journal database tests** use the existing isolated PostgreSQL harness (`src/features/era/execution/journal.database.test.ts`), never production (Hard Rule 26).
- **No paid model.** Model proposals come from fixtures or replay (Hard Rule 29).
- **Assertions** cover: requests sent (count, body, idempotency key), final state and outcome, receipt text, artifacts, offered reversal.

## 2. Scenarios

### 2.1 Repeated requests and retries

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-01 | Transfer card Drawer → Wallet $100, approved | Sami double-taps Confirm | One `POST /api/transfers`; one artifact; second tap is a no-op | LC-11, AP-5 |
| AC-02 | Same card open on Sami's phone and tablet (journal on) | Both tap Confirm within 1 s | One `begin` wins the CAS; the other shows `Execution changed. Refresh and resume.`; one transfer | LC-15, LC-27 |
| AC-03 | "Add milk to the list" done at 10:00:00 | Same sentence at 10:00:40 | `Add another? [Yes] [No]`; nothing sent until Yes | LC-27 |
| AC-04 | Same sentence at 10:05 (beyond 60 s) | — | Added normally (a second milk is a legitimate request) | LC-27 |
| AC-05 | Transfer POST timed out after the server committed | ERA replays once with the same `action_id` | Server returns the committed row; outcome *done*; exactly one transfer | LC-24, XD-2 |
| AC-06 | Spend draft POST timed out after commit (no client id today) | — | Outcome *uncertain*, `Check [Open]`; no automatic resend | AP-7, LC-24 |
| AC-07 | AC-06, person taps Check; a draft with the same amount, account and description exists after the action start | — | Outcome *done* with the discovered artifact; Undo offered | LC-24 |
| AC-08 | Retry of a *done* action (same `action_id`) | Person taps Try again on an old receipt | Receipt returned; nothing sent | LC-28 |

### 2.2 Timeouts with unknown outcomes

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-09 | Reminder create returns `completion: unknown` | — | `Check [Open]`; no "done" wording; no retry | LC-19, LC-24 |
| AC-10 | AC-09 with `action_id` used as item id | Check | GET by id: present → *done* with artifact; absent → `[Try again]` with the same id | LC-24 |
| AC-11 | Cover recurring Internet times out | Check reads `next_due_date` = 7 Dec | *done* (reconciled) | E2 |
| AC-12 | AC-11 but `next_due_date` still 7 Nov | Check | `[Try again]`; tapping it re-runs preconditions first | E2, LC-28 |
| AC-13 | Journal: a write step `running` for 130 s | Person taps Stop | Step *uncertain*, text `Check the app before continuing.`; never re-dispatched | LC-17; CURRENT `state.ts` |
| AC-14 | Journal: write step `running` for 30 s | Person taps Stop | Rejected; the request is allowed to finish | LC-17 |

### 2.3 Partial success

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-15 | E1: shopping add of 4 items; item 3 times out | — | Lines: 2 done (artifacts), 1 uncertain, 1 not started; run *partial*; `[Check] [Resume] [Stop]` | LC-25, E1 |
| AC-16 | AC-15, Check finds item 3 on the list | Resume | Only item 4 is sent | LC-25 |
| AC-17 | Plan step 2 `meal.assign` done, step 4 shopping fails *not_started* (offline before send) | — | Meal stays assigned with its reversal; shopping `[Try again]`; no rollback of step 2 | LC-25 |
| AC-18 | Draft confirm committed, balance-history entry missing | Check | *partial*; ERA shows `Balance not updated · [Open Accounts]`; no automatic money write | LC-21, AP-8 |
| AC-19 | E3: trip activation created the account and categories, status update failed | ERA reads after handoff | `Lisbon not active · empty trip account found · [Fix]`; Fix previews removal; Confirm required | E3, LC-26 |

### 2.4 Interruption

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-20 | Journal on; E3 run with 3 skips; first skip done | App closed, reopened | Same conversation shows `1 of 3 skipped · [Resume] [Stop]`; nothing runs until Resume | LC-29 |
| AC-21 | Journal off (default) | Same | Receipt for the first skip remains; no automatic continuation; the rest must be asked again | LC-29, A-8 |
| AC-22 | Card awaiting Confirm | Person taps New chat | Card discarded; nothing dispatched | LC-29, LC-12 |
| AC-23 | Card created for Maya | Shared device signs in as Sami, who taps the old card | Refused; nothing sent | AP-4 |

### 2.5 Stale approvals and changed inputs

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-24 | E2 transfer card previewed 09:00 with Drawer $310 | Confirm at 09:25 | Expired (money 15 min); fresh preview | LC-12 |
| AC-25 | E2 card previewed 09:00 with Drawer $310; Maya logs $150 from Drawer at 09:04 | Sami confirms at 09:06 | Balance version changed → re-preview `Drawer $160 → −$40`; nothing sent | LC-31 |
| AC-26 | "Remind me tomorrow at 9 to call the bank" previewed 23:50 | Confirm at 00:05 | Day changed for a relative date → re-preview with the original anchor shown (`Thu 5 Nov 09:00`) | LC-12 |
| AC-27 | E3: dentist rescheduled by Sami after Maya's preview | Maya confirms | `was 17 Nov 09:00 (moved by Sami) → 18 Nov 10:00`; escalated Confirm | LC-31, LC-10 |
| AC-28 | E1: "onions" added by Sami after preview | Pre-dispatch recheck | `4 items (onions already on the list)` | LC-31 |
| AC-29 | Catalogue place edit with `expected_revision` 4; server at 5 ⛁ | Confirm | 409 `stale_revision` → stale → fresh preview | LC-31 |
| AC-30 | Reminder deleted from the Schedule page after preview | Confirm reschedule | `No longer exists`; nothing sent | LC-31 |

### 2.6 Undo versus compensation

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-31 | Transfer done, row `live` | Undo | `DELETE /api/transfers/[id]` once; balances reversed; Redo available | LC-32 |
| AC-32 | Transfer edited in Transfers afterwards (status `changed`) | Open Artifacts | No Undo button | LC-32 |
| AC-33 | E1 meal slot replaced "Burger night" | Undo on the receipt | No Undo; `[Fix]` previews `Fri dinner · Burger night (restore)` from the stored previous value | LC-26, XD-9 |
| AC-34 | E2: Internet confirmed twice for 7 Nov (one in Recurring page, one via ERA) | Check | `[Fix]` previews `Delete duplicate Internet $45 · 4 Nov`; Confirm; soft delete with balance reversal | LC-26 |
| AC-35 | Occurrence skipped (no inverse) | Person asks to undo | `Can't undo here · [Open Schedule]` | LC-32 |
| AC-36 | Debt recorded, Undo tapped | — | Hard delete; no Redo offered | Matrix §3 |

### 2.7 Owner controls preserved

| ID | Given | When | Then | Rules |
|---|---|---|---|---|
| AC-37 | A model fixture proposes `transfer.create` | — | Rejected at admission (not a registered model capability); `I couldn't validate that action. Nothing was changed.` | AP-2; HUB-108 item 3 |
| AC-38 | A model fixture proposes `draft.confirm` | — | Confirm card with effective fields; no dispatch without tap | AP-1, AP-2 |
| AC-39 | Standing "Always add" rule exists | A model proposes `meal.assign` + `shopping.add` | Both still Confirm (standing rules cover Act-tier native only) | LC-13, AP-3 |
| AC-40 | Any write | Done | Exactly one Artifact per written entity | Owner rule 2026-10-04 |
| AC-41 | Reschedule done | Google backup fails | Outcome *done*; receipt adds `Calendar backup pending`; daily reconcile later heals it | LC-22 |
| AC-42 | Offline known before dispatch | Spend draft | Queued by the existing queue (not a new one); timeout instead → never queued | D11; Hard Rule 6 |

---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit beb8584 (application source identical to 22152c2). 'Today' columns are CURRENT IMPLEMENTATION; 'Rule' and 'Needs' columns are PROPOSED DESIGN. Nothing was executed."
---

# ERA Approval and Recovery Matrix

[README](README.md) · [Action Inventory](ACTION-INVENTORY.md) · [Action Lifecycle](ACTION-LIFECYCLE.md) · **Approval & Recovery Matrix** · [Acceptance Scenarios](ACCEPTANCE-SCENARIOS.md)

Per action: who must approve, what the approval binds to, how a lost response is resolved, what partial success looks like, and whether the action can be undone or needs compensation. Lifecycle rules (`LC-n`) and decisions (`XD-n`) are in [ACTION-LIFECYCLE](ACTION-LIFECYCLE.md).

## 1. Invariants (apply to every row)

| ID | Invariant | Source |
|---|---|---|
| AP-1 | Money movement, draft confirmation, deletes, series/occurrence edits and recurring cover are **Confirm**, always | `engine.ts` `MIN_TIER`; Top Layer §5 |
| AP-2 | Any model-interpreted write is Confirm | DEC-24; HUB-108 |
| AP-3 | Tiers only rise (escalators); no setting, standing rule or model lowers them | Top Layer §5; LC-10 |
| AP-4 | An approval covers one fingerprint: one capability, one target set, the values shown, one owner, one conversation, one anchor date | LC-9, LC-11 |
| AP-5 | An approval is consumed once and expires per LC-12 | `confirmation.ts`; XD-1 |
| AP-6 | A write without a receipt or artifact is *uncertain*, never *done* | `plan.ts:376-389` |
| AP-7 | No automatic retry of a write whose source has no idempotency key | LC-24; XD-2 |
| AP-8 | Compensation is always its own previewed, confirmed action | LC-26 |

## 2. Authorization and approval binding

| Action | Effect class | Tier today | Escalators | Approval binds to | Expires |
|---|---|---|---|---|---|
| Spend draft | Capture as draft | Act + Undo | Default or low-confidence account, inferred currency, partner account → Confirm | Amount, currency, account, category, date | Act: none; if escalated 30 min |
| Confirm draft | Money posting | Confirm | — | Draft id with `is_draft = true`; effective amount, account, category, date; account balance version | 15 min |
| Transfer | Money movement | Confirm | — | Both accounts, amount, currencies, both balance versions | 15 min |
| Record debt | Money record | Confirm | — | Debtor name, amount, currency | 15 min |
| Cover recurring | Money commitment | Confirm | — | Payment id, `next_due_date`, amount, account | 15 min |
| Log recurring payment | Money posting | Precision form | — | Handled by the form (ERA hands off) | — |
| Income, split | Money | Handoff | — | Form | — |
| Create reminder / event | One-time own schedule | Act + Undo (fast path); Confirm (model) | Recurrence → hand to Schedule; assignee is the partner; alert already sent | Title, due/start, alert, `recurrence = once`, assignee | 30 min; day change for relative dates |
| Reschedule reminder | Schedule change | Act + Undo; Confirm (model) | Target changed by someone else since resolution; series | Item id + `updated_at`, previous and new `due_at`, one-time | 30 min; day change |
| Complete reminder | Schedule change | Act; Confirm (model) | Recurring occurrence → occurrence contract | Item id + occurrence | 30 min |
| Delete reminder | Delete | Confirm | — | Item id + `updated_at`, effect `Recycle Bin` | 30 min |
| Series / occurrence / skip | Recurrence | Confirm | — | Item id, occurrence date, scope | 30 min; day change |
| Add shopping items | Shared list | Act + Undo; Confirm (model) | List belongs to the partner alone | List id, group, items, list membership at preview | 30 min |
| Remove / move shopping items | Shared list | Confirm card | — | Message ids | 30 min |
| Assign meal | Plan | Act; Confirm (model) | **Slot occupied**, especially by the other person | Slot (date, meal, person), recipe, occupant | 30 min; day change |
| Save note | Note | Act | Household audience | Label, value | — |
| Contact / place | Reference | Act + Undo | — | Name, tags, module | — |
| NFC reminder | Compound schedule | Confirm (model) | — | Tag id + state from the listed tags, reminder fields | 30 min |
| Lexicon rule / Forget | ERA vocabulary | Act | — | Rule key | — |
| Trip activation | Lifecycle, creates an account | Precision page | — | Trip `status`, dates | — |
| Calendar backup, push, preferences, calendar connect | Integration | Not ERA actions | — | — | — |

## 3. Execution and recovery

| Action | Idempotency today | Needs | If the outcome is unknown | Partial success | Reversal |
|---|---|---|---|---|---|
| Spend draft | None (`drafts/route.ts:69-79`) | Client id (XD-4) | Check: drafts since the action started with the same amount + account → found = done; none = Try again | n/a | **Undo** (draft delete) |
| Confirm draft | CAS on `is_draft` (`drafts/[id]/route.ts:50-64`); a second attempt returns 500 | Return 200 "already confirmed" (A-6); balance adjust in the same transaction | Check: draft row `is_draft = false` **and** a balance-history entry for it → done; row confirmed without the entry → *partial* | Row confirmed, balance not adjusted → owner repair via `data-repair`, never ERA | **Compensation** (delete the transaction: soft delete + balance reversal) |
| Transfer | **Client id** replay (`transfers/route.ts:33-36, 367-368`) | — | One automatic replay with the same id (XD-2) → committed row returned | n/a | **Undo** while `live` |
| Record debt | None | Client id | Check debts list for same name + amount since start | n/a | Undo = hard delete, no Redo |
| Cover recurring | None; no due-date claim | Claim (XD-3) | Check `next_due_date`: advanced → done; unchanged → Try again | n/a | **Undo** (`undoCoverRecurring`) while unchanged |
| Log recurring payment | None; offline replay without fence (`offlineSyncEngine.ts:201-203`) | Claim (XD-3); `reviewRequired` fence | Form's concern; ERA's later status read can detect two transactions for one due date | Transaction posted, due date not advanced (`recurring-payments/[id]/route.ts:274-278`) | **Compensation** (delete duplicate) |
| Create reminder / event | Optional `id` in contract (`createContract.ts:22`); offline create fenced | Send `action_id` as item `id` | `completion: unknown` → Check: GET the item by its id → found = done; absent = Try again with the same id | Item without alert/trigger → *partial* (SCH-24 receipt) | **Undo** (soft delete) |
| Reschedule | — | — | Check: item `due_at` equals the new value → done | n/a | **Undo** (previous `due_at`) |
| Complete | Upsert by occurrence (`items/[id]/actions/route.ts:106`) | — | Safe to retry (upsert) | n/a | **Compensation** (reopen in Schedule) |
| Delete reminder | Soft delete | — | Check: item trashed → done | n/a | **Undo** (restore) |
| Series edit | — | — | Check due date | n/a | Undo (previous `due_at`) |
| Occurrence edit / skip | — | Inverse (HUB-102) | Check occurrence exception | Some occurrences skipped | **Compensation** (Schedule) |
| Add shopping items | None; one request per item with progress (`resolvers/shopping.ts:80-100`) | Client ids, one bulk request (HUB-116, XD-4) | Check: list rows with that content created after the action started → reconcile per item | **Yes**: `Added 2 of 4` with per-item state | **Compensation** (remove card) |
| Remove / move shopping | — | — | Check rows | Some rows | Compensation |
| Assign meal | Slot-keyed upsert (`meal-plans/route.ts:140-170`) | Store `previous` (XD-9) | Check slot recipe | n/a | **Compensation** (re-assign previous) |
| Save note | Duplicate label → 409 | — | Check by label | n/a | Compensation (delete in Brain) |
| Contact / place | None | Client id | Check by name | Module created, item not → partial | **Undo** (soft delete) |
| NFC reminder | None | Single transaction | Reminder recorded, trigger "unverified" (HUB-108) | **Yes** | Reminder Undo; trigger compensation |
| Lexicon rule | Live-default unique index | — | Check rules | n/a | Forget (revoke) |
| Trip activation | Guard only `status = active` (`trips/[id]/activate/route.ts:27`) | One RPC, idempotent account (XD-7) | ERA reads the trip after handoff | Account/categories created, status not updated → second account on retry | **Compensation** (remove empty trip account) |
| Calendar backup | Idempotent reconcile | — | Report `Calendar backup pending` | n/a | None needed |

## 4. Recovery playbook by outcome

| Outcome | Person sees | Allowed next | Never |
|---|---|---|---|
| **not_started** | `Didn't go through · <reason>` | Edit, `[Try again]` (same `action_id`) | Silent auto-retry with a new id |
| **uncertain** | `Check [Open]` | `[Check]` (status read) → done / Try again / open module | "Failed" wording; automatic retry of an unkeyed write |
| **partial** | Per-part lines: done (with Undo), uncertain (Check), not started | `[Resume]`, `[Skip]`, `[Stop]`, Undo done parts | Re-running finished parts |
| **done, needs fixing** | Artifact row `[Fix]` | Previewed compensation, Confirm | Automatic compensation |
| **stale** | Fresh preview, changed fields marked | Confirm the new preview | Executing the old approval |
| **cancelled / expired** | Nothing, or `Stopped` | Ask again | — |

## 5. What "Check" reads

| Action | Read | Match rule |
|---|---|---|
| Reminder / event / contact / place / draft / transfer | `POST /api/era/actions/status` with the artifact (CURRENT) | Row exists and status `live`/`trashed` |
| Reminder create without an artifact | `GET` the item by the `action_id` used as its id (PROPOSED, XD-4 pattern) | Present |
| Draft confirm | Draft row + balance-history entry | Both present |
| Recurring cover / log | Recurring row `next_due_date`, transactions for the due date | Advanced; exactly one transaction |
| Shopping add | `shopping.list` (registered read) | Same content, same thread, created after the action began |
| Meal assign | Meal plans for the slot | Recipe equals the new one |
| Trip activation | Trip row, accounts named for the trip | `status = active`, exactly one trip account |

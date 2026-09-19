---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Trips — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../../../../Trips/Trips — Master Book.md>) updated 2026-08-19, read end to end. [Packets](<Trips — ASTRA Packets.md>). Study only; no DB calls.

## Book delta

`git log --since=2026-08-19 --format="%h %ad %s" --date=short -- src/features/trips src/app/api/trips src/components/trips src/lib/tripAccess.ts` returns `491bcba 2026-08-19 statement import`. Activation now sets account currency (`activate/route.ts:42–44`). The Overview's “no per-account currency” statement (§Out of scope) is stale. Budget owns matching/FX; TRIP-28 owns only a scoped entry point.

The Master Book verification manifest's “one test” omits `src/features/trips/documentQueries.test.ts`; `tripPhase.test.ts` also exists. Neither verifies lifecycle SQL. Its “RPC bodies absent” assertion is false as a repository statement: decode `migrations/db-state.json` → `db_state.functions[name=activate_trip|complete_trip].body`. Embedded timestamp is **2026-08-04T10:06:44.439516+00:00**. This is an historical catalog export, **not current DB evidence**; source recovery and current verification are separate tasks.

Planner improvements do not raise Live-mode confidence. Master Book §Vision explicitly exempts Planner work from the cascade gate; the later blanket “nothing else starts” sentence must be interpreted through that exemption. TRIP-18 remains an owner-application prerequisite in the checklist, not proof the migration is still unapplied today.

## Re-scored maturity

Same six Live-cascade dimensions as the Master Book; provisional ordinal assessment, not production measurement.

| Dimension | Book | ASTRA | Evidence |
|---|---:|---:|---|
| Design clarity | 8 | 6 | Historical SQL contradicts multiple documented cascade effects; F1 |
| Verification | 1 | 1 | TRIP-1/2/3 still have no attached round-trip witness |
| Repo recoverability | 2 | 5 | Historical bodies recoverable; current drift unknown |
| Cross-module safety | 3 | 2 | Separate account/cascade/status commits; F2 |
| Test protection | 1 | 1 | Planner tests are not lifecycle tests |
| Handoff | 2 | 4 | This study names falsifiable fixtures and current-state prerequisite |
| **Mean** | **2.8** | **3.2** | Recoverability gain is not permission to activate |

The fourth-generation escalation clause applies to **Live-mode enhancement work**: retain the freeze until evidence resolves the gate. Do not freeze the useful independent planner.

## Ranked findings

### F1 — Inspect the recovered contract before activating a real trip

**Historical evidence only:** the Aug4 snapshot's named bodies contain these exact predicates/operations:

| Function branch | Snapshot expression | Required discriminator |
|---|---|---|
| Household chore | Inserts one action at `v_start`, comment “representative” | Daily chore over three trip days: all three expected occurrences excluded, adjacent days retained |
| Household meal | `for_user_id = ANY(v_affected_users) OR household_id IS NOT NULL` | An unrelated household's non-null household ID must never qualify |
| Solo reassignment | Chores OR nonrecurring reminders in the window | Non-chore recurring event: does current behavior meet the documented reassignment rule? |
| Event reversal | `UPDATE item_alerts SET active = true WHERE item_id = ...` | An alert inactive before travel stays inactive afterward |
| Ledger ownership | `ON CONFLICT DO NOTHING` followed by unconditional ledger insert | Existing matching skip/pause survives completion; a trip cannot own a row it did not create |

**UNVERIFIED:** current bodies, grants, auth identity, predicates and behavior. Owner supplies fresh untruncated function definitions/catalog evidence, then isolated fixture outputs. These findings justify replacing “run a real trip first” with inspect → isolate → verify. No agent executes any SQL.

The Overview §Gotchas says service-role invocation establishes caller identity merely by passing the trip ID. Source uses `admin.rpc(...,{p_trip_id:id})` (`activate/route.ts:97`, `complete/route.ts:31`), while the historical bodies require `auth.uid()`. `SECURITY DEFINER` changes privileges, not a user ID argument into a JWT. **UNVERIFIED:** deployed function/auth behavior; owner evidence must resolve the mismatch without deleting authorization checks.

### F2 — The transaction boundary stops before the lifecycle does

`src/app/api/trips/[id]/activate/route.ts:34–121` creates an account, seeds categories/balance without checking every result, invokes a separate RPC, then updates trip status. Account deletion on RPC error is also unchecked. Completion likewise reverses effects before a separate status update (`complete/route.ts:31–50`). An RPC transaction cannot make those separate HTTP calls atomic. A status-write failure can leave effects committed with retry eligibility unchanged.

This is source-proven composition risk; no claim of observed production corruption. Before any automatic activation, one authenticated, idempotent transaction must own account linkage, effects and status, with concurrent activation and retry fixtures. That is **not** an S/M repair until F1/current-state evidence fixes the contract; no speculative migration packet is issued.

### F3 — Checkpoint “applied” counts inputs, not successful writes

`src/app/api/trips/[id]/packing/checkpoint/revert/route.ts:37–49` filters malformed entries away, awaits updates without inspecting their error/results, then returns `applied: entries.length`. A denied/missing row or failed update can be reported as restored. This is an ungated Planner defect. ASTRA-TRIP-2 makes acknowledgment truthful; full all-or-nothing rollback remains separately unresolved.

### F4 — M-02 conflicts with its own safety sequencing

Top Layer M-02 / checklist TRIP-1 says build TRIP-4's impact panel first. Master Book §Vision gates ledger enhancements behind verification; Overview §trip_side_effects says the ledger is internal rollback state, and §Completion accepts blind reversal. A panel cannot establish correctness of the writes it describes.

**CONFLICTS → M-02 sequencing / Trips ledger-display rule.** Recommend an owner-approved, read-only verification projection before product UI; build the eventual panel from a stable impact result, not direct coupling to rollback rows. Also **CONFLICTS → Overview §Completion v1 blind reversal**: preserve intervening human changes, or explicitly return a conflict. Reopening is justified if an isolated fixture demonstrates one overwritten manual edit. These proposals belong in Phase 5's Contradiction Register; no policy is silently changed here.

### F5 — Anticipation does not require activation

`src/features/trips/tripPhase.ts:19–31` derives dates independently of status. The planner already has itinerary, packing and documents (Feature Map junction/trips). E-04/E-22 can consume accessible upcoming-date facts and outstanding packing counts without calling a lifecycle RPC. Travel dates are not evidence that schedule effects happened. Keep “travelling” and “activated” separate in context provenance.

## Ranked enhancement catalog

| Rank | Study item | Size / severity | Mapping / dependency |
|---|---|---|---|
| 1 | ASTRA-TRIP-1: current contract and isolated lifecycle witness | M / blocker | EXTENDS → TRIP-1/2/3; DOCKS → M-02; sequencing conflict F4 requires owner decision |
| 2 | ASTRA-TRIP-2: checked checkpoint result | S / friction | NEW: TRIP-18 is schema application, not acknowledgment correctness |
| 3 | Date-derived trip signals | No new sheet | DOCKS → E-04/E-22; EXTENDS → TRIP-9; accepted context/briefing pipeline |
| Held | Atomic lifecycle/account transition; compare-before-reverse | Not dispatchable | EXTENDS → TRIP-1/2/3; current bodies and owner decisions first |
| Held | Trip audit entry point | Existing M scope | EXTENDS → TRIP-28; Budget BUD-26/27/28 must deliver an audit contract first |

## What ERA needs

Read facts: trip ID, access scope, dates, date phase, activation status, packing numerator/denominator excluding soft-deleted rows, document expiry without exposing files, account/currency references. Preserve complete/unavailable and observed-at metadata under E-04. Read-only capability first; no activation/completion registry tool while Live verification is absent. E-22's re-entry brief may report known dates; it must not promise “routines resume” from a date alone.

## Do not do

Do not pause recurring payments. Do not run production round-trips from an agent or treat a snapshot as current. Do not restore all alert flags to true. Do not delete rollback evidence to make a test appear clean. Do not enlarge the planner into cascade work, duplicate Budget's audit engine, or sum mixed currencies as actual spend.

## Coverage note

Owns Trips junction: planner, lifecycle boundary, documents, access and Budget/Schedule/Meal bridges. Current policy/storage grants and two-phone behavior remain owner-verified gaps. Prerequisites / guest-drink access observations in the old book belong to their real module owners, not this campaign. [Coverage appendix](<../ASTRA — Coverage & Orphans.md>) records ownership.

## ASTRA 10× Findings

- **Leverage:** Separate travel facts from lifecycle effects; ERA can anticipate a trip while the risky cascade stays gated (F5).
- **Leverage:** A current function contract plus adversarial fixtures retires three generations of vague verification work (F1).
- **Simplification:** Use one atomic lifecycle boundary eventually; route-side account seeding, compensating deletion and status commits multiply failure states (F2).
- **Frontier — DOCKS → E-22:** A departure/readiness brief joins existing trip, packing and document facts without a new planner or autonomous writes.
- **Uncomfortable:** Historical SQL was already recoverable, and its contents give reasons not to begin with a real-trip activation. “Missing SQL” had normalized an inspection gap (F1).


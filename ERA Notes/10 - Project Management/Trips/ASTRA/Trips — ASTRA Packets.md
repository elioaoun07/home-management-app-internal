---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Trips — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Cutoff `3106164`; Master Book updated 2026-08-19. [ASTRA Book](<Trips — ASTRA Book.md>) supplies F1–F5.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-TRIP-1 | EXTENDS → TRIP-1/2/3; DOCKS → M-02 | TRIP-1 / TRIP-2 / TRIP-3 | HELD for panel-first sequencing decision; then current owner contract before isolated witness; no parent tick on study |
| ASTRA-TRIP-2 | NEW | Unallocated; Trips owns | HELD for current checkpoint contract; no extra slot |

## Plan reconciliation

| Sheet / proposal | Mapping | Completion boundary |
|---|---|---|
| ASTRA-TRIP-1 | EXTENDS → TRIP-1/2/3; DOCKS → M-02; CONFLICTS → M-02 panel-first sequencing | An evidence package does not close unpassed round-trips |
| ASTRA-TRIP-2 | NEW | Existing schema-application ticket does not inspect write results |
| Date signals | DOCKS → E-04/E-22; EXTENDS → TRIP-9 | No duplicate accepted Top Layer sheet |
| Lifecycle atomicity / manual-edit preservation | EXTENDS → TRIP-1/2/3; CONFLICTS → Overview blind-reversal decision | Held for current contract and owner decision |
| Audit entry | EXTENDS → TRIP-28 | Budget engine first |

## Execution contract

These sheets are specifications, **NOT RUN**. Copy this block with an individually dispatched sheet. S ≤ half a session; M ≤ one 2–4h session. Study IDs allocate no campaign integers; Phase 5 landing above records the canonical queue. A partial child never closes an incomplete parent.

**Common gates:** named regressions execute nonzero cases and pass; `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` exit 0, with output and tested revision attached. The existing PM lint error for the missing DLV-77 migration path is a separately owned Phase-5 prerequisite, not permission to invent SQL. Tests use isolated fixtures and mocked clients; agents make no live DB calls. Owner-run DB/device evidence is separate from mocked tests.

**Forbidden in every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` (no rider in these campaign sheets); `migrations/schema.sql` without the explicitly paired migration; every path outside the exact allowlist; git writes, production data access, new dependencies, new modules, a second queue/recurrence engine, and changes to existing `/era` layout. New paths are marked **[NEW]**. Relevant PM trace paths named in each sheet are future implementation permissions, not study edits.

| STOP | Condition — stop and leave a five-line evidence/handoff note |
|---|---|
| S1 | A file outside the allowlist needs editing. |
| S2 | A DB write is needed; hand the owner the manual runbook and await APPLIED evidence. |
| S3 | Test count decreases, a required check is red, or a targeted regression executes zero cases. |
| S4 | HubPage grows or a new import of its internals is required. |
| S5 | A new dependency is required. |
| S6 | Work cannot finish in one session; split before proceeding. |
| S7 | A visibility/permission symptom appears; obtain fresh owner DB-state evidence or Hard Rule 27's untruncated queries before route diagnosis. |
| S8 | Money/schedule semantics are ambiguous; ask one focused question rather than guessing. |
| S9 | An AI proposal would write without the required confirmation. |
| S10 | A second engine, queue, parser, regex family, toast system or aggregate for an existing concept is introduced. |
| S11 | Work enters D2's entirely excluded scope. |
| S12 | An existing `/era` element is moved or restyled. |

**NOT done, in every sheet:** migration written ≠ APPLIED; test file ≠ test in CI include; local success ≠ evidence pasted; transport acceptance ≠ observed household outcome; child implementation ≠ parent completion.


**PM allowlist P:** `ERA Notes/10 - Project Management/Trips/4 - Checklist.md`; `ERA Notes/10 - Project Management/Trips/Trips — Master Book.md`.

## ASTRA-TRIP-1 · Lifecycle contract and isolated witness · M · H · before M-02 product UI

**Outcome:** The owner has a falsifiable account of what activation and completion change before relying on them.

**Prereqs:** Owner accepts F4's sequencing amendment; provides fresh lifecycle definitions, trigger/policy/grant evidence and catalog timestamp. TRIP-18's migration is APPLIED before any planner-dependent device exercise. No agent DB calls. An owner-selected isolated fixture environment/data plan is required before any write demonstration; this sheet never directs a production experiment.

**Skills:** `start-task → recurrence-safety → money-rules → data-repair → finish-task`.

**Files:** `ERA Notes/03 - Junction Modules/Trips/Lifecycle Verification.md` **[NEW]**; `ERA Notes/03 - Junction Modules/Trips/Overview.md`; plus P. Read-only inputs: both lifecycle routes, the fresh owner export, existing snapshot, recurrence engine and connected Overview docs. No SQL implementation or source edits are allowed.

**Boundary:** Record function identity/version and auth contract; compare each historical predicate in F1 with the fresh definition. Supply an owner-run inspect/backup/fixture/verify/rollback plan covering household, solo, unlinked owner, unrelated household, pre-existing skip/pause, inactive alert, mid-trip human edit, repeat/concurrent activation, and final status-write failure. Stop at any failed prerequisite; record the smallest follow-on fix, not guessed replacement SQL.

**DB change?** No implementation. Owner-run isolated verification can change fixture rows; agents only prepare the runbook and evaluate supplied evidence.

**AI call added?** No.

**Money/schedule math?** Yes: daily chore Sep6–8 has exactly three exclusions and Sep5/9 remain; an initially inactive alert remains inactive after the round-trip; a distinct household loses zero meals; recurring-payment rows and balances remain unchanged. Account creation yields one zero-balance linked expense account and no duplicate on retry. Compare before/after row IDs and values, not just counts.

**Gate:** Owner attaches dated, untruncated outputs for every matrix row, including before/after account balances, recurrence occurrences, ledger ownership and current function identity. Mark each PASS/FAIL/UNVERIFIED explicitly. Completion of this *study packet* requires the whole matrix and supported dispositions; TRIP-1/2/3 may be ticked only when their actual round-trip/guard criteria pass. `pnpm pm:lint` → exit 0; attach output. No new application test is claimed.

**PM:** Keep unverified parents open. Partial Shipped Log: `- ✅ YYYY-MM-DD — **TRIP-1** (ASTRA-TRIP-1 evidence prerequisite) Current lifecycle contract and isolated witness matrix recorded for TRIP-1/2/3; passed/failed/unverified cases: <evidence>.`

**NOT done:** Historical snapshot ≠ current contract; an authored runbook ≠ executed evidence; all matrix dispositions recorded ≠ all cases passed; no cascade or panel shipped.

**STOP:** S1–S12 above; no real-trip mutation delegated to an agent.

## ASTRA-TRIP-2 · Check packing checkpoint results · S · E · Planner correctness

**Outcome:** Checkpoint restore reports success only when every requested target was actually updated.

**Prereqs:** TRIP-18 migration `migrations/2026-08-04_trips-packing-checkpoint-recyclebin.sql` owner-stamped APPLIED; E-01 CI. Fresh DB-state if any access symptom appears. Do not infer application from the old checklist.

**Skills:** `start-task → fix-bug → api-route → finish-task`.

**Files:** `src/app/api/trips/[id]/packing/checkpoint/revert/route.ts`; `tests/trip-checkpoint-revert.test.ts` **[NEW]**; `ERA Notes/03 - Junction Modules/Trips/Overview.md`; plus P.

**Boundary:** Validate the complete stored snapshot, reject malformed entries instead of silently filtering, require returned target identity from each update, inspect every result, and refuse a success acknowledgment for missing/denied/failed rows. Preserve trip scoping and exclude soft-deleted targets. Return existing error handling on partial failure with structured server evidence; never label attempted count “applied.” This bounded repair exposes partial failure; it does not promise atomic rollback or repeat the updates automatically.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No. Packing fixture: three requested rows, middle update fails → no success response claiming three; all three returned IDs → applied 3.

**Gate:** `pnpm exec vitest run tests/trip-checkpoint-revert.test.ts --reporter=verbose` → nonzero mocked route cases pass for success, malformed snapshot, SDK error, zero rows, wrong trip, soft-deleted row and unauthenticated caller. Common gates pass. Owner screenshot at 390×844 after an isolated failure shows existing error handling and no successful restore toast.

**PM:** **HELD / UNALLOCATED** — HELD for current checkpoint contract; no extra slot. Before any future dispatch, the owner admits this sheet and the owning campaign allocates a never-used ID after rechecking its entire history. Then use `- ✅ YYYY-MM-DD — **<new campaign ID>** (ASTRA-TRIP-2) <Outcome above>; <all gate evidence>.` No parent is ticked for this held proposal.

**NOT done:** Common distinctions apply; checked results ≠ all-or-nothing restore, concurrency-safe Undo or cascade verification.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage:** Falsifiable lifecycle witnesses precede product confidence; a panel is not a substitute.
- **Simplification:** No duplicate travel-signal or statement-audit engine; dock those outcomes to E-04/E-22 and Budget.
- **Uncomfortable:** Checkpoint restoration currently counts requests rather than successful changes; ASTRA-TRIP-2 closes only that claim.

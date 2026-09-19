---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Healthcare — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../../../../Healthcare/Healthcare — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-HLTH-1 | NEW | HLTH-21 | Later; scoped feed availability only, no clinical claim |

## Plan reconciliation

| Proposal | Mapping | Boundary |
|---|---|---|
| ASTRA-HLTH-1 | NEW | Availability truth, not keyword/clinical semantics |
| Core verification | DOCKS → E-00; EXTENDS → HLTH-7 | Current owner evidence, no automatic rerun |
| Skill sequencing | EXTENDS → HLTH-19 | Before medication implementation |
| Google confidence | CONFLICTS → Master Book identity “verified” claim | HLTH-12 alarm evidence stays distinct from event ID |
| List projection | EXTENDS → HLTH-18 | Held pending payload/usage measurement |

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


## ASTRA-HLTH-1 · Preserve allergen feed availability · M · E · before extending warnings

**Outcome:** Recipe warnings distinguish a checked result from an unavailable or cached allergen feed.

**Prereqs:** E-01 CI; HLTH-7 current privacy witness and core migration owner-stamped APPLIED before device verification. ASTRA-KIT-3 coordinates ingredient-shape validation; this sheet changes no recipe storage. Preserve owner-confirmed household allergy visibility.

**Skills:** `start-task → fix-bug → cache-invalidation → ui-guardrails → finish-task`. HLTH-19 is a prerequisite for later medication work, not an invented blocker for this feed-state repair.

**Files:** `src/hooks/useHouseholdAllergens.ts`; `src/components/web/RecipeAllergenWarning.tsx`; `src/components/web/RecipeDetailView.tsx`; `src/lib/health/allergenFeedState.ts` **[NEW]**; `tests/allergen-feed-state.test.ts` **[NEW]**; `ERA Notes/02 - Standalone Modules/Healthcare/Overview.md`; `ERA Notes/10 - Project Management/Healthcare/4 - Checklist.md`; `ERA Notes/10 - Project Management/Healthcare/Healthcare — Master Book.md`.

**Boundary:** Validate feed payload shape; malformed/missing allergens is an error, not[]. Preserve query status/dataUpdatedAt with matched output through a small tested adapter used by the actual hook/component. Cached hits remain visible on offline or failed refresh; no cached data yields unavailable. Preserve per-ingredient flags and keyword rules. Expose a compact status/i affordance only where availability is ambiguous; no explanatory banner or “safe” label, no cooking gate. Retain existing cache key/invalidation unless owner scope evidence requires a separately scoped fix.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No. Availability fixture: successful empty feed→checked-empty; first-load503→unavailable; cached peanut hit + offline→hit retained with cached status; successful refresh removing the allergy→new checked result.

**Gate:** `pnpm exec vitest run tests/allergen-feed-state.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose` → nonzero cases pass for loading, malformed payload, empty success, first failure and cached failure. Common gates. Owner390×844 recipe capture covers first-load failure, cached offline hit and refreshed result; two-account privacy/allergen evidence belongs to HLTH-7 and must be attached, not inferred from mocks.

**PM:** Tick HLTH-21 only after every sheet gate passes. Shipped sentence: `- ✅ YYYY-MM-DD — **HLTH-21** (ASTRA-HLTH-1) Recipe warnings preserve checked/cached/unavailable feed state; fixtures and device evidence: <evidence>.` HLTH-7 and medication parents remain open until their own criteria pass.

**NOT done:** Keyword no-match ≠ food safety; cache availability ≠ current DB/privacy verification; no medications or new list-warning projection shipped.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage:** Make the absence of knowledge distinguishable from an empty checked result.
- **Simplification:** Keep ingredient validation with Kitchen and feed availability with Healthcare; share contracts rather than feature directories.
- **Uncomfortable:** Successful matcher tests cannot prove the warning is present when its input fetch fails.

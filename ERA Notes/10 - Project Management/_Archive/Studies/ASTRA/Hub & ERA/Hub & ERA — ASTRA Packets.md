---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Hub & ERA — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source cutoff `3106164`; deltas the [Master Book](<../../../../Hub & ERA/Hub & ERA — Master Book.md>) `updated: 2026-09-02`. [ASTRA Book](<Hub & ERA — ASTRA Book.md>) supplies F1–F3. Accepted [Top Layer Packets](<../../Top Layer/Top Layer — ASTRA Packets.md>) remain the sole execution sheets for E-01–E-23 refinements.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-HUB-1 | NEW | HUB-57 | Later; actual draft envelope/link only |
| ASTRA-HUB-2 | NEW | HUB-58 | Later; checked inverse results only, atomic inverse remains open |

## Plan reconciliation

| Sheet | Mapping | Boundary |
|---|---|---|
| ASTRA-HUB-1 | NEW | Future-payment response contract in manual chat conversion, not ERA activity logging |
| ASTRA-HUB-2 | NEW | Existing bulk inverse fails closed on failed responses; does not fabricate its missing server endpoint |

Existing E-09b/c and later Budget atomicity work precede any promise of atomic conversion/replay. F3 is not solved by either narrow sheet. Phase 5 assigns canonical HUB IDs, with no reuse.

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

## ASTRA-HUB-1 · Link future conversion to the actual draft · S · E · correctness prerequisite

**Outcome:** A future-payment conversion links its source message to the saved draft's real ID.

**Prereqs:** E-01a CI; confirm the existing `{draft}` response contract. Migrations required APPLIED: none. No new DB effect.

**Skills:** `start-task → fix-bug → money-rules → cache-invalidation → finish-task`.

**Files:** `src/components/hub/AddTransactionFromMessageModal.tsx`; `src/features/hub/createdDraft.ts` **[NEW, small injectable create-and-link adapter used by the modal and its test]**; `tests/hub-created-draft.test.ts` **[NEW]**; `ERA Notes/10 - Project Management/Hub & ERA/4 - Checklist.md`; `ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md`; `ERA Notes/03 - Junction Modules/Message Actions/Overview.md`. Common forbidden paths apply.

**Boundary:** Extract only the modal's existing future-draft create/link sequence into the injectable adapter, retaining the existing request functions. Destructure/validate the successful draft envelope using its real response shape; a missing draft/id must not create a null-target action or report completion. Keep the returned ID through the existing action-link call; do not resubmit domain creation when only tracking failed. Reuse installed Zod if a runtime validator is needed. Test the adapter that the modal actually calls, not a duplicate sequence. This does not make the two writes atomic or introduce a new API client or queue.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Draft-only invariant: account $100 → create future expense draft $20 → account stays $100; action references the draft UUID. No date conversion or posting behavior changes.

**Gate:** `pnpm exec vitest run tests/hub-created-draft.test.ts --reporter=verbose` → nonzero cases pass: real `{draft:{id}}` envelope, malformed/missing ID and error body. Mocked conversion fixture confirms one draft request, the returned UUID passed to linking, zero confirmation requests, no automatic draft retry on link failure. Common gates pass. Existing test tooling only; no live money fixture.

**PM:** Tick HUB-57 only after every sheet gate passes. Tick only that item after gate evidence; Shipped Log: `- ✅ YYYY-MM-DD — **HUB-57** (ASTRA-HUB-1) Future chat conversion validates the draft envelope and links the returned ID; malformed-response/one-create fixture: <evidence>.`

**NOT done:** Common distinctions apply; correct draft ID ≠ atomic conversion, safe replay or applied live constraints.

**STOP:** S1–S12 above.

## ASTRA-HUB-2 · Refuse false bulk Undo completion · S · E · correctness prerequisite

**Outcome:** A failed inverse prerequisite stops bulk Undo before further destructive steps and prevents a success claim.

**Prereqs:** E-01a; F2's route inventory attached. Migrations required APPLIED: none. The missing action-ID DELETE endpoint is not implemented in this sheet; refusal is the intended behavior until a separately reviewed inverse exists.

**Skills:** `start-task → fix-bug → money-rules → cache-invalidation → finish-task`.

**Files:** `src/components/hub/BulkConvertReviewSheet.tsx`; `src/features/hub/undoMessageConversion.ts` **[NEW, sequential checked inverse adapter]**; `tests/hub-conversion-undo.test.ts` **[NEW]**; `ERA Notes/10 - Project Management/Hub & ERA/4 - Checklist.md`; `ERA Notes/10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md`; `ERA Notes/03 - Junction Modules/Message Actions/Overview.md`. Common forbidden paths apply.

**Boundary:** Extract only the existing per-record inverse into an injectable adapter; check every HTTP status and SDK error before advancing or marking that record reversed. Keep confirmed, failed and uncertain results distinct; overall success requires every selected inverse to be confirmed. Preserve truthful partial results and invalidate affected existing keys even after partial completion. Do not bypass the missing endpoint with direct DB calls, invent an atomic guarantee or silently compensate. No new production text is specified; existing failure/success affordances receive the correct branch.

**DB change?** No. No new endpoint or direct mutation authority.

**AI call added?** No.

**Money/schedule math?** Financial guard: account $80 after a $20 expense; action-link DELETE returns 404 → zero downstream transaction deletes, account remains $80, reversal is not marked complete. A mocked successful owning inverse returns $100 once; this sheet does not certify that server inverse's atomicity.

**Gate:** `pnpm exec vitest run tests/hub-conversion-undo.test.ts --reporter=verbose` → nonzero cases pass: first response 404 prevents target deletion; second response 500 is not success; resolved SDK `error` is not success; mixed batch retains partial evidence; duplicate result handling does not report double reversal. Common gates pass. Tests inject fake effects; no real row deletions.

**PM:** Tick HUB-58 only after every sheet gate passes. Shipped Log: `- ✅ YYYY-MM-DD — **HUB-58** (ASTRA-HUB-2) Bulk Undo checks every inverse result and stops on failed prerequisites; negative HTTP/SDK fixtures: <evidence>.` Keep the missing atomic inverse and F3 in Pain Inventory; do not tick a broader conversion-safety parent.

**NOT done:** Common distinctions apply; an honest blocked Undo ≠ a working atomic inverse; HTTP completion ≠ all batch records reversed.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage — NEW / ASTRA-HUB-2:** a small checked-effect boundary prevents a missing route from masquerading as a successful financial inverse.
- **Simplification — DOCKS → E-09/E-13:** reuse accepted atomicity/host sheets; do not duplicate their queue or assistant work here.
- **Frontier:** None beyond the accepted Top Layer evaluation frontier; adding another would fragment the same evidence.
- **Uncomfortable — NEW / F3:** both sheets can pass while composite conversion remains non-atomic. Their PM trace must preserve that unresolved defect.

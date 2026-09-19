---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Outfits — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../../../../Outfits/Outfits — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-OUT-1 | NEW | OUT-20 | Later; verified atomic composition before planner |
| ASTRA-OUT-2 | CONFLICTS → OUT-19 / checklist D2 | Unallocated; Outfits owns | HELD for ONE-request amendment; no new ID |

## Plan reconciliation

| Proposal | Mapping | Boundary |
|---|---|---|
| ASTRA-OUT-1 | NEW | Atomic save boundary; does not build planner |
| ASTRA-OUT-2 | CONFLICTS → OUT-19 / checklist D2 | Owner amendment permits bounded batches; no silent truncation |
| Wear contract | EXTENDS → OUT-12/14; CONFLICTS → Overview §4 / OUT-12 “verbatim” | Held until locking, membership and last-date semantics settled |
| Device acceptance / AI | EXTENDS → OUT-19; DOCKS → M-08 | Existing gates and priority retained |
| Ordinary deletion | NEW, owner policy decision | Existing archive is candidate; no delete-policy implementation sheet |
| Event/trip suggestions | EXTENDS → OUT-16/17 | Held on confirmed wear history |

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

## ASTRA-OUT-1 · Save an outfit atomically · M · H · before planner

**Outcome:** A rejected or failed save leaves the previous outfit metadata and composition intact.

**Prereqs:** E-01 CI. E-00/OUT-19 owner evidence of the core tables/storage and current DB-state export; core migration APPLIED. Owner-authorized manual application of this sheet's paired migration before completion. OUT-12 is not required and is not implemented here.

**Skills:** `start-task → fix-bug → api-route → db-migration → finish-task`.

**Files:** `src/app/api/outfits/route.ts`; `src/app/api/outfits/[id]/route.ts`; `tests/outfit-save.test.ts` **[NEW]**; `migrations/YYYY-MM-DD_outfit-atomic-save.sql` **[NEW: execution date]**; `migrations/schema.sql` **[paired only]**; `ERA Notes/02 - Standalone Modules/Outfits/Overview.md`; `ERA Notes/10 - Project Management/Outfits/4 - Checklist.md`; `ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md`.

**Boundary:** Keep existing Zod/response contract. One authenticated transaction validates all garments, updates/creates metadata and replaces composition; lock an existing outfit before replacement. Enforce the authenticated owner inside the boundary, never a caller-supplied owner or household expansion. Failure rolls back all writes. Preserve slot uniqueness and existing deletion semantics. Reuse a current equivalent DB function if owner evidence reveals one. Do not add a generic outfit service or change image upload.

**DB change?** Yes — manual migration first, paired snapshot second. Include owner-run isolated-fixture rollback/verification SQL and function privileges in the runbook; agents never execute it. Current policies/functions remain UNVERIFIED until the owner supplies the export.

**AI call added?** No.

**Money/schedule math?** No. Integrity fixture: saved metadata A with garments [g1,g2] + invalid g3 or injected insert failure → metadata A and [g1,g2] remain; valid save B/[g2,g4] → both change together. Foreign-owner garments fail without mutation.

**Gate:** `pnpm exec vitest run tests/outfit-save.test.ts --reporter=verbose` → nonzero route cases for auth, validation, one atomic call, failure and success pass; common gates. Owner-run DB transaction/concurrent-save fixture from the migration must separately prove rollback, scope and no mixed composition. A mock RPC success does not prove atomicity. OUT-19 phone save→reopen capture at390×844 demonstrates the preserved response shape.

**PM:** Tick OUT-20 only after every sheet gate passes. Shipped sentence: `- ✅ YYYY-MM-DD — **OUT-20** (ASTRA-OUT-1) Outfit create/replace saves metadata and composition atomically; owner APPLIED, rollback and route evidence: <evidence>.` OUT-19 and planner parents remain open until their own gates pass.

**NOT done:** Migration written ≠ APPLIED; image upload/delete and wear history are unchanged; atomic save ≠ network retry idempotency for new outfits.

**STOP:** S1–S12 above.

## ASTRA-OUT-2 · Sign all visible garment paths · S · E · after batch-contract decision

**Outcome:** Wardrobes beyond 100 distinct images render without silently missing the remaining photos.

**Prereqs:** Owner resolves CONFLICTS → OUT-19/checklist D2: accept one request per nonempty batch of at most100 distinct paths, not one request per image or a hard screen cap. E-01 CI and core/storage owner-stamped APPLIED evidence for device verification.

**Skills:** `start-task → fix-bug → cache-invalidation → finish-task`.

**Files:** `src/features/outfits/useSignedUrls.ts`; `src/features/outfits/queryKeys.ts`; `src/lib/wardrobeSignedUrls.ts` **[NEW]**; `tests/wardrobe-signed-urls.test.ts` **[NEW]**; `ERA Notes/02 - Standalone Modules/Outfits/Overview.md`; `ERA Notes/10 - Project Management/Outfits/4 - Checklist.md`; `ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md`.

**Boundary:** Deduplicate/sort the complete input for cache identity; split only the transport payload into batches≤100, merge successful maps, reject failed/malformed batches instead of reporting a complete fresh result. The small injectable signing helper must be used by the actual hook and retain safeFetch/timeout. Cached URLs may remain on refetch failure via existing query semantics. No endpoint cap increase, per-image requests, new persistence layer or automatic expiry claims.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** No. 0/100/101/205 distinct paths →0/1/2/3 signing calls and complete maps; duplicate input adds no calls. Inputs sharing first100 but differing afterward must have distinct complete cache keys.

**Gate:** `pnpm exec vitest run tests/wardrobe-signed-urls.test.ts --reporter=verbose` → nonzero cases above, failed second batch and malformed response pass; common gates. Owner390×844 grid network capture with101 images shows2 batch requests,101 resolved paths, no per-image signing; repeat uses cache. Use owner-approved fixture images, no agent production setup.

**PM:** **HELD / UNALLOCATED** — HELD for ONE-request amendment; no new ID. Before any future dispatch, the owner admits this sheet and the owning campaign allocates a never-used ID after rechecking its entire history. Then use `- ✅ YYYY-MM-DD — **<new campaign ID>** (ASTRA-OUT-2) <Outcome above>; <all gate evidence>.` No parent is ticked for this held proposal.

**NOT done:** Batch completeness does not prove URL renewal after an hour, storage policies, or the first-use cutout latency.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage:** The save and signing fixes repair existing owner workflows before optional AI input.
- **Simplification:** One save boundary, one complete image-path set, no new media service.
- **Uncomfortable:** A one-request metric passed by dropping data is the wrong success criterion.

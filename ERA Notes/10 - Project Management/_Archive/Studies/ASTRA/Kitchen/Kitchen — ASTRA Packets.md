---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Kitchen — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source cutoff `3106164`; deltas [Kitchen Master Book](<../../../../Kitchen/Kitchen — Master Book.md>) `updated: 2026-07-30`. [ASTRA Book](<Kitchen — ASTRA Book.md>) supplies F1–F5. These are three bounded prerequisites; automation, full inverses and cooking-count repair remain explicitly outside their outcomes.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-KIT-1 | EXTENDS → KIT-1; DOCKS → M-03 | KIT-1 | Existing prerequisite; automatic shopping remains held behind contracts |
| ASTRA-KIT-2 | EXTENDS → KIT-4; DOCKS → E-08/E-22 | KIT-4 | Existing Later slice; do not tick broader KIT-7/nudge work |
| ASTRA-KIT-3 | NEW | Unallocated; Kitchen owns | HELD; no new ingredient-producer queue item this landing |

## Plan reconciliation

| Sheet | Mapping | Parent status after child |
|---|---|---|
| ASTRA-KIT-1 | EXTENDS → KIT-1; DOCKS → M-03 | Remains open until low-stock auto-add is idempotent and observed |
| ASTRA-KIT-2 | DOCKS → E-08/E-22; EXTENDS → KIT-4/KIT-7 | Remains open until actual consumer/briefing and calendar criteria pass |
| ASTRA-KIT-3 | NEW | Ingredient producer validation is missing from the existing loop packets; Phase 5 leaves it held and unallocated |

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

**PM allowlist P (each sheet):** `ERA Notes/10 - Project Management/Kitchen/4 - Checklist.md`; `ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md`. Update only the named parent and evidence.

## ASTRA-KIT-1 · Atomic restock and history at the existing boundary · M · E · before automatic stock effects

**Outcome:** Concurrent restocks preserve the total quantity and one matching history record for each accepted increment.

**Prereqs:** Owner supplies fresh body/grants/constraints for `restock_inventory_item`, stock and history; Aug4 snapshot is historical only. E-01 CI. Migration below must be owner-stamped APPLIED before endpoint cutover.

**Skills:** `start-task → fix-bug → db-migration → api-route → cache-invalidation → finish-task`.

**Files:** `src/app/api/inventory/restock/route.ts`; `src/features/inventory/hooks.ts`; `migrations/YYYY-MM-DD_inventory-restock-contract.sql` **[NEW, executor substitutes actual date]**; `migrations/schema.sql` paired only; `migrations/README.md` **[prerequisite-created Applied ledger]**; `tests/inventory-restock.test.ts` **[NEW]**; `ERA Notes/02 - Standalone Modules/Inventory/Overview.md`; plus P.

**Boundary:** Validate UUID and finite positive numeric quantity using Zod. Replace route-side read/add/write/history with the reviewed existing transaction seam. Derive the authorized owner from authenticated identity; never trust a freely supplied user ID. Within SQL lock the stock row before recording before/after values; handle absent stock through a verified unique owner/item contract, with no destructive dedupe. History failure rolls back the increment. Preserve existing runout behavior only after its current trigger is verified. Use safeFetch for the existing restock mutation; no new offline eligibility or retry queue. Repeated *distinct* restocks are separate operations; request-idempotent replay remains outside this sheet and must precede automated replay.

**DB change?** Yes if the current function/constraints do not meet the contract. Write the paired manual runbook first, including inspect/verify/rollback and owner isolation fixtures; STOP for owner application. No agent DB execution.

**AI call added?** No.

**Money/schedule math?** No money/occurrence math. Stock example required: 5 units + concurrent 2 and 3 → 10; history forms 5→7→10 or 5→8→10. Failure inserting history leaves quantity unchanged. String `"2"`, infinity and negative input are rejected.

**Gate:** `pnpm exec vitest run tests/inventory-restock.test.ts --reporter=verbose` → nonzero mocked route/auth/input cases pass. Owner's isolated SQL fixture proves concurrent increments, absent-row race, history rollback and cross-owner refusal; outputs attached. Common gates pass; migration APPLIED alone is insufficient.

**PM:** Keep KIT-1 open. Partial Shipped Log: `- ✅ YYYY-MM-DD — **KIT-1** (ASTRA-KIT-1 prerequisite) Restock and history share a verified transaction; concurrency/auth/rollback evidence: <evidence>.`

**NOT done:** Common distinctions apply; atomic increment ≠ idempotent retry, low-stock auto-add or recipe consumption.

**STOP:** S1–S12 above.

## ASTRA-KIT-2 · Shared meal coverage for calendar and ERA · M · E · E-08/E-22 prerequisite

**Outcome:** A meal's leftovers, status and intended person contribute consistently to calendar and ERA coverage.

**Prereqs:** Reviewed E-04a completeness interface specification and E-08a boundary specification; neither completed consumer implementation is a prerequisite; E-01 CI. Migrations required APPLIED: none; existing date/status/assignment columns are already in the source schema.

**Skills:** `start-task → fix-bug → timezone-handling → cache-invalidation → finish-task`.

**Files:** `src/lib/mealPlanCoverage.ts` **[NEW]**; `src/features/meal-planning/hooks.ts`; `src/app/api/meal-plans/route.ts`; `src/components/web/WebMealPlanCalendar.tsx`; `src/features/era/intents/resolvers/chef.ts`; `src/features/era/intents/resolveIntent.test.ts`; `tests/meal-plan-coverage.test.ts` **[NEW]**; `ERA Notes/03 - Junction Modules/Meal Planning/Overview.md`; plus P.

**Boundary:** Extract existing date expansion into a pure shared contract rather than introducing a competing expansion engine. Separate display membership from edible/planned coverage: skipped rows can stay visible but do not cover a meal; person-specific meals only cover that person, shared meals both. Use date-only local calendar semantics. Fetch actual interval overlap, replacing the arbitrary 14-day lookback and date-only origin read; keep existing auth/household filter. ERA's existing all-day gap remains an all-day gap, not an assertion all meal slots are filled. Preserve per-slot facts for E-08/E-22. Failed retrieval is unavailable, not zero meals. Do not create Items or change calendar layout.

**DB change?** No. Query existing columns; current authorization remains separately owner-verified.

**AI call added?** No.

**Money/schedule math?** Yes, calendar coverage: cooked Sep4, eats-through Sep7 → Sep6 covered; same row skipped → uncovered; partner-only → owner uncovered/partner covered. No extra schedule occurrences or stock deduction.

**Gate:** `pnpm exec vitest run tests/meal-plan-coverage.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero cases pass for leftovers crossing query boundary, >14-day interval, status, person, leap/month boundary and Beirut DST. Mock route retrieval proves overlap without omitted older rows; empty complete versus failure differ. Common gates; 390×844 calendar capture preserves layout.

**PM:** Partial Shipped Log: `- ✅ YYYY-MM-DD — **KIT-4** (ASTRA-KIT-2 partial) Calendar and ERA share scoped meal coverage with interval-overlap reads; date/person/status fixtures: <evidence>.` Do not tick E-22 delivery or KIT-7's remaining integration on a helper alone.

**NOT done:** Common distinctions apply; a shared date helper ≠ meal delivery, nutrition advice or a full weekly meal plan.

**STOP:** S1–S12 above.

## ASTRA-KIT-3 · Validate stored ingredient shapes at writer boundaries · M · E · before new recipe consumers

**Outcome:** Invalid ingredient objects are rejected before they can corrupt recipe storage or its existing warning consumer.

**Prereqs:** E-01 CI; inspect the named writer bodies and existing ingredient/step types. No migration required APPLIED. Existing malformed rows are not silently repaired.

**Skills:** `start-task → fix-bug → api-route → finish-task`.

**Files:** `src/lib/recipeSchema.ts` **[NEW]**; `src/types/recipe.ts`; `src/app/api/recipes/route.ts`; `src/app/api/recipes/[id]/route.ts`; `src/app/api/recipes/[id]/versions/route.ts`; `src/app/api/recipes/[id]/generate/route.ts`; `tests/recipe-ingredient-contract.test.ts` **[NEW]**; `src/lib/health/allergenMatch.test.ts`; `ERA Notes/02 - Standalone Modules/Recipes/Overview.md`; plus P.

**Boundary:** One installed-Zod ingredient/step schema, with types derived where touched. Nonempty string name and existing string quantity/unit conventions, optional notes/section/optional preserved; do not guess numeric units or strip malformed ingredient rows into an apparently complete recipe. Validate at the four named persistence boundaries before writes; PATCH validates supplied fields without replacing omitted arrays. Model-generated data passes the same validation. External extraction/optimization/scale/substitution response validation is retained follow-up scope; storage validation catches their accepted payloads here. No medical keyword edits or new AI call.

**DB change?** No.

**AI call added?** No; existing generation is mocked, not invoked.

**Money/schedule math?** No. Ingredient quantity remains source text; no stock or nutrition computation.

**Gate:** `pnpm exec vitest run tests/recipe-ingredient-contract.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose` → nonzero cases pass: valid ingredient with optional metadata reaches the existing matcher; null/nonstring name and malformed arrays produce zero DB writes; partial PATCH preserves omitted fields; invalid model data cannot overwrite a recipe. Common gates pass.

**PM:** **HELD / UNALLOCATED** — HELD; no new ingredient-producer queue item this landing. Before any future dispatch, the owner admits this sheet and the owning campaign allocates a never-used ID after rechecking its entire history. Then use `- ✅ YYYY-MM-DD — **<new campaign ID>** (ASTRA-KIT-3) <Outcome above>; <all gate evidence>.` No parent is ticked for this held proposal.

**NOT done:** Common distinctions apply; structural validity ≠ complete ingredients, clinical safety or validated AI semantics.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage — EXTENDS → KIT-1:** use the existing transactional stock seam after current authorization/locking review; delete duplicate arithmetic.
- **Leverage — DOCKS → E-08/E-22:** a single coverage contract is more useful than independently adding meal counts to several screens.
- **Simplification — EXTENDS → KIT-7:** derive meal projections from their source intervals; no duplicate scheduled meal records.
- **Frontier — NEW, parked:** the Book's ten-case availability experiment stays outside these sheets.
- **Uncomfortable — EXTENDS → KIT-1/KIT-2:** three passing prerequisites still do not complete the automatic loop; keep parent checkboxes honest.

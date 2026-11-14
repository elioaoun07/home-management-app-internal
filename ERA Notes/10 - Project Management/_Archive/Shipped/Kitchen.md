---
created: 2026-11-11
updated: 2026-11-11
type: archive
status: superseded
owner: Elio
---

# Kitchen — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed Kitchen items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../Kitchen/Kitchen — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### KIT-11

- ✅ 2026-09-26 — **KIT-11** Return the correct cooking count — [criteria](#kit-11)

**UAT instructions:** [Step-by-step owner wizard](<../../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#v2-11-b--save-two-cooking-logs-and-check-the-count>) (drafted 2026-10-25; original results retained).

**Outcome:** Return the correct cooking count.

- **Acceptance:** Reproduce the documented HEAD/count response handling and use the actual count metadata. Verify zero/error/nonzero without treating absent body data as zero.
- **Touches:** `src/app/api/recipes/[id]/cooking-log/route.ts`

**Provenance:** [Kitchen — Master Book.md](<../2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The defect is two adjacent lines, verified 2026-09-20 in `src/app/api/recipes/[id]/cooking-log/route.ts`: line ~118 queries `.select("id", { count: "exact", head: true })` — a HEAD request, so PostgREST returns the number in the response _metadata_ and `data` is null — and line ~124 then does `times_cooked: (countData as any)?.length ?? 1`, reading `.length` off that null and falling back to 1. Use the `count` field the same call already returns, and keep zero distinguishable from an error: an absent body is not zero. The `as any` is also a live instance of the type debt DLV-52 tracks. Consumer of the value: `times_cooked` in the list `select` of `src/app/api/recipes/route.ts` and the recipe cards.

```delivery-plan-v1
{
  "outcome": "The recipe's cooking count reflects the number of logs recorded for that recipe.",
  "acceptance": [
    "Posting a cooking log writes the number of logs the count query reported into the recipe's times_cooked.",
    "A reported count of zero is written as zero.",
    "A count that is not reported, or a count query that fails, leaves times_cooked unwritten rather than replacing it with an invented number.",
    "The log that was already written is still returned, so the caller does not retry into a second log.",
    "The rating average and the two timestamps written by the same call are unchanged."
  ],
  "scope": [
    "src/app/api/recipes/[id]/cooking-log/route.ts"
  ],
  "steps": [
    "Read the recipe statistics update at the end of the POST handler.",
    "Take the number from the count field that the existing head request already returns, instead of reading length off its empty body.",
    "Build the update payload so times_cooked is present only when a number was reported and the query did not fail.",
    "Leave the log insert, the rating average and both timestamps exactly as they are."
  ],
  "invariants": [
    "One log row is written per request.",
    "Exactly one recipe update per request.",
    "A reported zero is a value, not an absence.",
    "An unknown count never becomes a written number.",
    "No file is created, renamed or deleted, and no other file changes."
  ],
  "exclusions": [
    "The list route and the recipe cards that read the value.",
    "The GET handler in the same file.",
    "The shape of the log row and the response status.",
    "Repairing rows already stored as one.",
    "Wider type cleanup beyond the two lines in question."
  ],
  "checks": [
    "kit11-cooking-count"
  ],
  "risks": [
    "The count field and the response body are easy to confuse; reading the wrong one reproduces the defect unchanged."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": true,
  "provenance": "Prepared 2026-09-20 from the item's own reading guide and a line-by-line read of the route. The protected oracle separates the current code from a corrected control on a host checkout and inside the checker container."
}
```

### KIT-20

- ✅ 2026-10-04 — **KIT-20** Patch catalogue metadata with revision checks — [criteria](#kit-20)

**UAT instructions:** [Delivered-slice owner wizard](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#catalogue--keep-edits-and-detect-a-stale-save>) (drafted 2026-10-25; original results and remaining gates retained).

**Accepted specification:** [Catalogue final build plan §10](<../../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C02. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Patch catalogue metadata with revision checks.

- **Acceptance:** Catalogue C02: validate typed partial updates, preserve unrelated metadata and use revision preconditions for stale writes. Safe create/edit foundation precedes promotions and corrections.
- **Depends on:** [KIT-18](<../../Kitchen/Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C02, and it gates KIT-21/22/24, HLTH-23 and TRIP-33 — so it is the foundation item. The defect is concrete: `src/app/api/catalogue/items/[id]/route.ts` PATCH assigns `updates.metadata_json = body.metadata_json` wholesale, with no zod import in the file and no revision precondition. That means an untyped partial write clobbers unrelated metadata, and two concurrent edits silently last-write-wins. The typed metadata interfaces already exist in `src/types/catalogue.ts` (`DocumentItemMetadata` and siblings) — use them to verify the runtime field contract, then infer touched TypeScript types from Zod so the two cannot drift, per Hard Rule #12. A revision precondition needs a column and a conditional update (Hard Rules #24/#26); a stale write should surface as a conflict, not a 500. Client mutation: `useUpdateItem()` in `src/features/catalogue/hooks.ts`.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose `tests/catalogue-patch.test.ts`: omitted/null/unset/false/zero, unknown keys, nested replacement, wrong collection, protected pointers and concurrent edit. Local route mocks plus owner isolated CAS witness; typecheck/lint.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/catalogue-patch.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Apply typed partial Catalogue edits without erasing unrelated metadata or another device's changes.",
  "acceptance": [
    "Only changed fields are written; unknown untouched fields and legacy values survive.",
    "Revision comparison/increment are one DB operation; stale requests return conflict and preserve editor input.",
    "All authored writers participate in revision rules, with compatible old-client rollout."
  ],
  "scope": [
    "src/types/catalogue.ts",
    "src/app/api/catalogue/items/",
    "src/app/api/catalogue/sub-items/",
    "src/features/catalogue/hooks.ts",
    "src/components/web/CatalogueItemDialog.tsx",
    "src/components/web/CatalogueTaskItemDialog.tsx",
    "migrations/",
    "migrations/schema.sql",
    "tests/catalogue-patch.test.ts"
  ],
  "steps": [
    "Freeze the writer census and first slice: typed item PATCH plus revision CAS; map image, Inventory, promotion and sub-item follow-ons before dispatch.",
    "Author additive revision migration after C00 evidence; implement expected_revision with metadata_set/metadata_unset and explicit field-owner allowlists.",
    "Validate changed known keys, category/module ownership and set/unset conflicts; replace nested values at declared top-level keys without guessed deep merges.",
    "Have editors send differences and explicit clears, retain failed input and support conflict reapply; stage legacy non-destructive compatibility before strict precondition enforcement.",
    "Bring alternate writers and guarded inverses into the same contract, then verify complete acceptance; the first slice alone cannot close KIT-20."
  ],
  "invariants": [
    "Missing precondition and stale revision are distinct outcomes.",
    "Generic metadata writes cannot alter operational stock policy or authorized file pointers."
  ],
  "exclusions": [
    "Universal revision service, metadata normalization/backfill and taxonomy replacement."
  ],
  "risks": [
    "A safe main PATCH remains bypassable through unconverted writers or older queued clients."
  ],
  "unknowns": [
    "Current client/queue census; strict cutover timing requires evidence."
  ],
  "dependencies": [
    "KIT-18",
    "Catalogue C00 and compatible-client rollout"
  ],
  "risk": "high",
  "provenance": "2026-09-26 checked wholesale metadata_json replacement and Catalogue C02/§10.7. Broad accepted scope is retained as sequenced slices, not declared delivery-ready.",
  "checks": [],
  "ownerReviewed": false
}
```

- **Implemented 2026-10-04 (code; migration applied by owner 2026-10-04 — witness [KIT-25](<../../Kitchen/Kitchen — Master Book.md#kit-25>)).** `src/lib/catalogue/itemPatch.ts` is the one Zod contract for create and PATCH, and `UpdateItemInput` is derived from it. PATCH writes `metadata_set` / `metadata_unset` by key; legacy `metadata_json` merges and never replaces. `expected_revision` makes the route return 409 with the current row. A metadata merge is compare-and-set on `revision`. A BEFORE UPDATE trigger owns the increment, so every writer participates; pin/favorite/position and calendar hints don't bump it. The response carries `inverse`, so the update toast's Undo is real. `CatalogueItemDialog` / `CatalogueTaskItemDialog` send only managed keys through `diffMetadata`, so cleared fields clear, hidden fields are no longer forced to `active`/`normal`, and emptied trigger conditions clear. Evidence: `tests/catalogue-patch.test.ts` (16 cases), ERA suite 478 passed, typecheck clean. Not witnessed on device.

### KIT-4

- ✅ 2026-10-27 — **KIT-4** Expose scoped meal coverage to ERA — [criteria](#kit-4)

**Outcome:** Expose scoped meal coverage to ERA.

**Touches:** `src/lib/mealPlanCoverage.ts`, `src/app/api/meal-plans/route.ts`, `src/features/meal-planning/hooks.ts`, `src/components/web/WebMealPlanCalendar.tsx`, `src/features/era/intents/resolvers/chef.ts`, `tests/meal-plan-coverage.test.ts`, `src/features/era/intents/resolveIntent.test.ts`

**Delivery preparation (2026-10-27):** Revalidated the existing seven-file plan against the current checkout and changes since its 2026-09-26 evidence cutoff (`45b28899`). The helper and coverage test are still proposed; the other five paths exist. GET still filters origin dates, the hook still uses a 14-day lookback, the calendar owns leftover expansion, and Chef still reduces origin dates to a Set. Later Chef consent/artifact changes and unrelated resolver tests must be retained. Retained candidate manifests show no changed-path overlap with BUD-83 C1 (`cand-f6ae4776ef53`, five transaction/split files) or DLV-107 C1 (`cand-33d28f42e41a`, `scripts/pm/app/Work.tsx`); the pre-release pure compatibility check nevertheless returns **Must follow BUD-83** (`shared-contract` on `src/lib/utils/splitBill.ts` and its test), because its conservative module matcher relates the calendar’s `@/lib/utils` import to that utility namespace. DLV-107 returns **Can run together**. Preserve those decisions and the one-writer limit; no reservation was released and their records remain intact. Offline policy preparation: `.delivery/v2/preparations/prepare-policy-kit4.mjs` and `kit4/REVIEW.md`. This is not implementation, plan approval or launch readiness: the viewer-identity seam remains unresolved; the protected oracle continuation below records its separate validation. R44's owner result is recorded separately in PM Settings → Tests → Tests after Apply; M5's agent fixture review does not substitute for that record or pass the pending physical-phone check.

**Protected oracle continuation (2026-10-27):** `tests/delivery-oracles/kit4-meal-coverage.mjs` now has 54 pinned behavioral assertions. The unchanged source fails 45; an isolated corrected control passes 54/54; eleven independent negative controls are rejected, both on the host and in the existing no-network pinned checker. Proposed helper observation seam for owner review: `getMealActiveDates(plan)` and `mealCoversDate(plan, date, viewerId, mealType?)`; this is test preparation, not an implemented or approved product API. Corrected implementations exist only in synthetic fixtures. The owner independently installed matching revision 12 at 21:37 Beirut; this preparation performed no activation. Codex-only execution, all existing safeguards and seven publication paths are unchanged. Passive service readiness still needs fresh runtime/model/environment observations through the owner’s normal Check readiness control. Fresh read-only evidence records the owner’s R44 **Passed** at 2026-10-27 21:18 Beirut (`app-497cee609b88`); its launch gate is clear. The current candidate-bound R44 handover also has the owner’s 21:10 Beirut sign-off; the separate documented physical-phone scenario remains unverified. Latest read-only audit observes owner releases for BUD-83 at 21:31 Beirut and DLV-107 at 21:32; neither action was performed by this preparation. Their candidates/evidence remain retained and the reservation blocker is cleared. **Release** relinquishes reservation protection, so subsequent changes may make a future Apply conflict; BUD-83’s historical result also lacks the currently-required typecheck/candidate-test evidence. No reservation, plan, delivery, candidate or application was changed by this preparation. Validation and exact policy diff remain in the existing `kit4/REVIEW.md` packet.

**Shipped 2026-10-27 (implemented directly, not through Delivery):** `src/lib/mealPlanCoverage.ts` is the one local-date contract. `getMealActiveDates` is calendar display membership, with skipped rows shown and leftovers inclusive. `mealCoversDate` is coverage: planned, shopping_added or cooked; the intended person; an optional slot. `GET /api/meal-plans` returns interval overlap for `date` and `start`/`end` with no age cutoff. It accepts YYYY-MM-DD only. The household lookup uses `maybeSingle`, and a lookup error is 503, not an empty plan. The weekly hook drops the 14-day lookback and its UTC end-date. The calendar imports the shared expansion, and its `fmtDate` now formats local dates; `toISOString` had put the week start on Saturday in Beirut. Chef resolves the viewer via `supabaseBrowser().auth.getUser()` (same seam as the budget and reminder resolvers) and returns `ok:false` on any failed read. Evidence: the protected oracle passes 54/54 on the real source (now the regression test `tests/delivery-v2/kit4-oracle.test.ts`); `tests/meal-plan-coverage.test.ts` and `resolveIntent.test.ts` pass 70/70; tsc clean. Not observed: a 390×844 calendar capture. Policy revisions 12/13 and the environment re-stage for this item were superseded by the standing Delivery policy (DLV-148).

- **Acceptance:** Verify person, status and leftover interval coverage and distinguish unavailable from no planned meal. Chef already reads meal data; reuse that path. Complete the consumer adapter before HUB-45/HUB-56; a pure helper alone does not complete the meal surface.

**Retained contract — ASTRA-KIT-2:**

- **Outcome:** A meal's leftovers, status and intended person contribute consistently to calendar and ERA coverage.
- **Boundary:** Extract existing date expansion into a pure shared contract rather than introducing a competing expansion engine. Separate display membership from edible/planned coverage: skipped rows can stay visible but do not cover a meal; person-specific meals only cover that person, shared meals both. Use date-only local calendar semantics. Fetch actual interval overlap, replacing the arbitrary 14-day lookback and date-only origin read; keep existing auth/household filter. ERA's existing all-day gap remains an all-day gap, not an assertion all meal slots are filled. Preserve per-slot facts for E-08/E-22. Failed retrieval is unavailable, not zero meals. Do not create Items or change calendar layout.
- **Money/schedule math?:** Yes, calendar coverage: cooked Sep4, eats-through Sep7 → Sep6 covered; same row skipped → uncovered; partner-only → owner uncovered/partner covered. No extra schedule occurrences or stock deduction.
- **Gate:** `pnpm exec vitest run tests/meal-plan-coverage.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero cases pass for leftovers crossing query boundary, >14-day interval, status, person, leap/month boundary and Beirut DST. Mock route retrieval proves overlap without omitted older rows; empty complete versus failure differ. Common gates; 390×844 calendar capture preserves layout.

**Provenance:** [4 - Checklist.md](<../2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** The existing Chef reader is `resolveMealPlanGaps()` in `src/features/era/intents/resolvers/chef.ts`, which fetches the next seven days and builds a Set of `planned_date`; `src/lib/ai/context.ts` has no meal reader. This corrects the earlier context-assembler routing claim. Read that resolver, `src/app/api/meal-plans/route.ts`, the 14-day lookback in `src/features/meal-planning/hooks.ts`, and the calendar's current date expansion. Replace origin-only retrieval with interval overlap and share coverage semantics across the calendar and Chef. Preserve person/status/slot facts and unavailable versus successfully empty data. A helper without the existing consumer adapter does not complete KIT-4 or unblock HUB-45/HUB-56.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Create `tests/meal-plan-coverage.test.ts`, then run it with `src/features/era/intents/resolveIntent.test.ts`; typecheck/lint. Cases: >14-day leftovers, skipped/shared/person-only rows, empty versus unavailable, leap/month/DST edges; preserve the calendar at 390×844.

**Scope notes:** `src/lib/mealPlanCoverage.ts`: proposed. `tests/meal-plan-coverage.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Make the existing calendar and Chef gap answer agree on whose meals cover each local day.",
  "acceptance": [
    "Overlapping leftovers are retrieved even when cooked more than fourteen days earlier.",
    "Skipped meals cover nobody; person-specific meals cover their intended person; shared meals cover both.",
    "Chef reports unavailable retrieval separately from a successfully empty plan and retains its all-day gap meaning."
  ],
  "scope": [
    "src/lib/mealPlanCoverage.ts",
    "src/app/api/meal-plans/route.ts",
    "src/features/meal-planning/hooks.ts",
    "src/components/web/WebMealPlanCalendar.tsx",
    "src/features/era/intents/resolvers/chef.ts",
    "tests/meal-plan-coverage.test.ts",
    "src/features/era/intents/resolveIntent.test.ts"
  ],
  "steps": [
    "Read resolveMealPlanGaps and the calendar date expansion; define one local date-only coverage contract with status, intended person and per-slot facts.",
    "Replace the hook's fixed lookback and API origin-date-only filters with actual interval-overlap retrieval, retaining household authorization.",
    "Reuse the shared contract in the calendar and existing Chef resolver; obtain explicit viewer identity and retain complete/empty/unavailable status.",
    "Verify the Sep4-to-Sep7 leftover example on Sep6 for owner, partner and skipped variants; exercise route and consumer behavior together."
  ],
  "invariants": [
    "Calendar display membership differs from edible coverage; visible skipped rows need not disappear.",
    "No new expansion engine, Items records or claim that one meal fills every slot."
  ],
  "exclusions": [
    "Calendar redesign, stock consumption, nutrition advice and new AI generation."
  ],
  "risks": [
    "A correct helper still leaves Chef wrong if the existing consumer keeps its planned_date Set."
  ],
  "unknowns": [
    "Confirm the current authorized viewer identity seam before freezing the adapter signature."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 read: meal-plans GET, meal-planning hooks and Chef resolveMealPlanGaps. src/lib/ai/context.ts has no meal reader; the older guide's proposed entry point is corrected below.",
  "checks": [],
  "ownerReviewed": false
}
```

## State log

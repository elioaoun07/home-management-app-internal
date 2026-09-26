---
created: 2026-09-10
updated: 2026-09-26
type: master-book
status: active
owner: Elio
---

# Outfits — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Digitize garments, compose outfits, plan and record wear. Standalone; personal per-user ownership is a deliberate sharing exception.

## Current state & evidence

Catalogue/builder and on-device cutouts shipped together. Owner deployment/device proof, complete image signing and transactional composition remain open. Planning/wear, AI tags and optional dreams are distinct phases; authored SQL is not applied SQL.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- D1: 2D paper doll. D2: sizing profile only, no body rendering. *(IMPLEMENTED 2026-07-18)*
- D3: catalogue → builder → planner → wear log; owner amendment July18 shipped catalogue and builder together and deferred AI tagging. The planner remains Phase4.
- D4: personal per user, no household sharing. D5: free tools, small WebP images, on-device background removal, private bucket and stored paths. D6: no offline write queue in v1.
- AI accelerates editable manual tagging; quota loss must not remove core functionality. A server background-removal service is not the agreed end state; reopening D5 requires an owner decision.
- DEC-08 holds complete signing above100 records versus the one-request promise; DEC-09 holds garment delete/restore. OUT-20 atomically saves composition but does not resolve either.
- Wear history must preserve historical membership, concurrency/retry and last-worn semantics; marking unworn cannot corrupt a different wear record. Visual studies may inspire manually ported changes, never own product behavior.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Campaign acceptance

- **D1** Every phase ends with the `finish-task` skill: typecheck/lint clean, migration↔schema.sql paired, Atlas current, this checklist ticked and [Outfits — Master Book](<Outfits — Master Book.md>) stamped.
- **D2** Phase 1 acceptance on a real phone: photo → cutout → tagged garment in the grid in under a minute, with ONE batch signed-URL request per screen.
- **D3** No STOP condition from [Overview §10](<../../02 - Standalone Modules/Outfits/Overview.md>) violated (alpha-flattening compressor, top-level imgly import, base64/URLs in DB, household joins, EXISTS RLS, unconfirmed AI writes, missing `timeoutMs`, Undo-less toasts).

## Pain Inventory

🔴 **OUT-19** Verify Outfits deployment, privacy and both-phone behavior. See [acceptance](<#out-19>) for the root cause, evidence and gate.

🟠 **OUT-20** Save outfits and membership atomically. Dated source diagnosis; cause and witness limits are in [criteria](<#out-20>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

**Plan navigation:** Open items below carry embedded drafts under [item execution plans](../_Conventions.md#9-item-execution-plans). Read only the selected ID and its dependencies. Prepared 2026-09-26 against source HEAD `45b28899`; implementation review, owner SQL application and device acceptance remain separate. No plan is owner-reviewed or dispatched by this document update.

### OUT-19

**Outcome:** Verify Outfits deployment, privacy and both-phone behavior.

- **Acceptance:** *(bundled into the Phase-0 owner day, packet **E-00**, of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>) — its pass/fail gates whether **M-08**/OUT-7 runs in Phase 3)* (Phase 1) Real-phone acceptance: owner verifies core migration APPLIED evidence and applies only missing reviewed SQL, then photo → cutout → tagged garment in the grid in under a minute with ONE batch signed-URL request per screen; measure the first-use model download on a real network

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-executed phone acceptance; no code change. What to read so you can interpret the result: the migration files under `migrations/` for the Outfits tables (`wardrobe_items`, `wardrobe_profiles`, `outfits`, `outfit_items`) and their end state in `migrations/schema.sql` — and per Hard Rule #27, `migrations/db-state.json` is the only repo artifact that is evidence about RLS. The one-batch signed-URL claim is measurable in `src/features/outfits/useSignedUrls.ts` (`useWardrobeImageUrls`) against `src/app/api/outfits/signed-urls/route.ts`, whose Zod body caps `paths` at 100. Revalidated 2026-09-26: the client also silently slices the sorted paths to 100, so one request does not prove complete image coverage; OUT-21/DEC-08 own the larger-wardrobe contract. The capture path is `src/components/outfits/AddGarmentSheet.tsx` plus `useCreateGarment()`/`useUploadGarmentImages()` in `src/features/outfits/hooks.ts`. Agents never apply the SQL (Hard Rule #26).

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Owner records migration application, served revision, both-phone capture timing and first-use download on a real network. Count signed-URL requests on a ≤100-path fixture and separately record >100 as DEC-08/OUT-21 unresolved; verify cross-user denial and reopen.

**Scope notes:** `migrations/db-state.json`: owner-supplied refresh.

```delivery-plan-v1
{
  "outcome": "Establish that the shipped personal wardrobe works privately on both phones before adding AI tagging.",
  "acceptance": [
    "Owner evidence confirms required tables/private storage and the current served build.",
    "Photo→cutout→editable tags→saved grid completes in under a minute, with first-use download measured separately.",
    "The agreed one-batch signing behavior and strict personal ownership are verified without concealing the >100-path gap."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md",
    "migrations/db-state.json"
  ],
  "steps": [
    "Obtain current migration/storage evidence and served revision; compare with the authored wardrobe/outfit migration without applying SQL.",
    "Prepare the owner phone sequence: select photo, produce alpha-preserving on-device cutout, tag manually, save, reopen and inspect network requests.",
    "Run the sequence on both phones as separate personal users; verify each can read only their own records and images.",
    "Record first-use model download separately from warmed capture timing; explicitly witness up to 100 signed paths and leave larger wardrobes under DEC-08.",
    "Record PASS/FAIL/UNVERIFIED and any bounded follow-up; do not mark deployment complete from local source inspection."
  ],
  "invariants": [
    "No household joins or v1 offline write queue.",
    "Free on-device removal, WebP alpha, private bucket and storage paths remain the accepted design."
  ],
  "exclusions": [
    "AI tags, server background removal, batching policy changes and garment delete/restore decisions."
  ],
  "risks": [
    "The current client slices paths at 100, so a one-request trace alone can hide missing images."
  ],
  "unknowns": [
    "Current owner SQL application, real-network timing and both-phone privacy; DEC-08 remains unresolved above 100 paths."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 read useWardrobeImageUrls and signed-urls route: client slice(0,100), server max(100). Snapshot date is 2026-08-04; no deployment or device witness was obtained.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-7

**Outcome:** Expand outfit generation parts.

- **Acceptance:** *(packet **M-08** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #2, only runs if OUT-19 passed)* (Phase 2) Widen `GenerateOptions` parts to accept `inlineData` image parts (non-breaking; repo-wide typecheck is the proof) → `src/lib/ai/gemini.ts`
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small and precisely located: `src/lib/ai/gemini.ts`, the `GenerateOptions` interface — `contents: Array<{ role: "user" | "model"; parts: { text: string }[] }>` (verified 2026-09-20). Widening `parts` to a union that also accepts `inlineData` is the change; `generateContentWithFallback()` in the same file is the consumer, and every other caller in `src/lib/ai/` and `src/app/api/ai-chat/` must still compile — a repo-wide `pnpm typecheck` is literally the acceptance. Do not change the fallback-model or 429 discrimination logic while you are in there.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** `pnpm typecheck` across the repository is the accepted non-regression gate; lint the touched file. Inspect existing text callers and a typed image-part example; no live Gemini call is needed.

```delivery-plan-v1
{
  "outcome": "Allow the existing Gemini generation wrapper to accept image parts without changing text callers.",
  "acceptance": [
    "GenerateOptions parts accept text or inlineData containing mimeType and data.",
    "Existing text-only callers compile unchanged.",
    "Fallback models, quota discrimination and runtime request behavior remain unchanged."
  ],
  "scope": [
    "src/lib/ai/gemini.ts"
  ],
  "steps": [
    "Confirm OUT-19 passed, then read the installed SDK types and current GenerateOptions shape before changing the public type.",
    "Introduce/export the smallest GeminiPart union and use it in contents.parts, matching the accepted Outfits Overview contract.",
    "Check all generateContentWithFallback callers for inferred type compatibility without rewriting their prompts.",
    "Run repository-wide typecheck and targeted lint; review the diff for runtime or fallback logic changes."
  ],
  "invariants": [
    "This is a non-breaking type widening, not a new generation engine.",
    "Image data is transient request input, never persisted to wardrobe rows."
  ],
  "exclusions": [
    "Tagging route, model changes, quota handling, image generation and storage changes."
  ],
  "risks": [
    "An overly broad any/object type can compile while admitting unsupported parts; keep the union precise."
  ],
  "unknowns": [
    "Revalidate installed SDK part typing at implementation time; OUT-19 owner acceptance remains the existing gate."
  ],
  "dependencies": [
    "OUT-19"
  ],
  "risk": "low",
  "provenance": "2026-09-26 docs-grounded from Outfits Overview §6 and current Master Book type signature. The single-file scope must be rechecked against the current SDK before dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-8

**Outcome:** Offer editable AI garment tags.

- **Acceptance:** `tag-garment` route (enum-constrained JSON via `generateContentWithFallback`, Zod-parsed, 429→cooldown) + Auto-tag button with `timeoutMs: 60_000` pre-filling editable form fields
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

- **Acceptance:** auto-tag pre-fill works end-to-end into editable fields; a forced 429 shows the cooldown toast with manual tagging unaffected; a repo-wide typecheck proves no existing Gemini caller regressed.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** New route beside the existing ones in `src/app/api/outfits/`; follow `.claude/skills/api-route/SKILL.md` and copy the auth → Zod → DB → error-mapping shape from `src/app/api/outfits/items/route.ts`. The model call is `generateContentWithFallback()` in `src/lib/ai/gemini.ts`, with `isDailyQuotaError()` for the 429→cooldown discrimination; depends on OUT-7 if the request carries an image part. Client side: the form is `src/components/outfits/AddGarmentSheet.tsx` and the mutation neighbours are in `src/features/outfits/hooks.ts` (`useCreateGarment`, `useUpdateGarment`). Hard Rule #6 — an AI call must pass `timeoutMs: 60_000` to `safeFetch()` or it aborts at 8 s. Fields stay editable: AI proposes, the human confirms.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/outfit-tag-garment.test.ts`: valid enums, malformed model JSON→422, oversize/auth rejection, per-minute/daily 429 and timeout. Verify editable prefill, later typing preservation, failed request and manual save at 390×844; typecheck/lint.

**Scope notes:** `src/app/api/outfits/tag-garment/route.ts`: proposed. `src/features/outfits/types.ts`: only for shared response schema. `tests/outfit-tag-garment.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Offer optional AI garment-tag suggestions that remain editable and never save without confirmation.",
  "acceptance": [
    "The authenticated image route returns enum-constrained Zod-validated suggestions through the existing Gemini wrapper.",
    "Auto-tag pre-fills editable fields; manual tagging and Save remain available after rejection, timeout or quota loss.",
    "The client uses timeoutMs:60000; 429 returns the existing cooldown contract."
  ],
  "scope": [
    "src/app/api/outfits/tag-garment/route.ts",
    "src/components/outfits/AddGarmentSheet.tsx",
    "src/features/outfits/hooks.ts",
    "src/features/outfits/types.ts",
    "tests/outfit-tag-garment.test.ts",
    "ERA Notes/04 - UI & Design/Page & Feature Atlas/"
  ],
  "steps": [
    "After OUT-19/7, reuse current wardrobe enums and rate-limit/error types; freeze the multipart image limit and response schema from Overview §6.",
    "Implement auth→1MB image validation→existing generation wrapper→runtime response parsing, mapping malformed suggestions to 422 and quota errors to 429.",
    "Add a short Auto-tag action using safeFetch with the explicit long timeout; apply suggestions to form state only and guard against stale responses overwriting later edits.",
    "Keep manual editing/save intact and give a genuine form-state inverse if showing a success Undo toast; store provenance only with the user's confirmed save.",
    "Exercise mocked model/quota/failure cases, mobile controls and Atlas registration; do not call the live model for tests."
  ],
  "invariants": [
    "AI proposes; the user saves.",
    "Personal ownership and existing on-device cutout pipeline remain unchanged."
  ],
  "exclusions": [
    "Automatic garment writes, try-on, paid image service and new offline queue."
  ],
  "risks": [
    "A late AI response can overwrite manual edits; cancellation/request identity must protect local form state."
  ],
  "unknowns": [
    "Current quota error response shape and existing form inverse seam must be reread."
  ],
  "dependencies": [
    "OUT-19",
    "OUT-7"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 plan follows accepted Outfits Overview §6 and existing AI/wardrobe patterns. Route and fixture paths are proposed; no live model request or implementation was performed.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-20

**Outcome:** Save outfits and membership atomically.

- **Acceptance:** Save an outfit and its garment membership atomically so a failed edit preserves the previous composition.

**Retained contract — ASTRA-OUT-1:**

- **Outcome:** A rejected or failed save leaves the previous outfit metadata and composition intact.
- **Boundary:** Keep existing Zod/response contract. One authenticated transaction validates all garments, updates/creates metadata and replaces composition; lock an existing outfit before replacement. Enforce the authenticated owner inside the boundary, never a caller-supplied owner or household expansion. Failure rolls back all writes. Preserve slot uniqueness and existing deletion semantics. Reuse a current equivalent DB function if owner evidence reveals one. Do not add a generic outfit service or change image upload.
- **Money/schedule math?:** No. Integrity fixture: saved metadata A with garments [g1,g2] + invalid g3 or injected insert failure → metadata A and [g1,g2] remain; valid save B/[g2,g4] → both change together. Foreign-owner garments fail without mutation.
- **Gate:** `pnpm exec vitest run tests/outfit-save.test.ts --reporter=verbose` → nonzero route cases for auth, validation, one atomic call, failure and success pass; common gates. Owner-run DB transaction/concurrent-save fixture from the migration must separately prove rollback, scope and no mixed composition. A mock RPC success does not prove atomicity. OUT-19 phone save→reopen capture at390×844 demonstrates the preserved response shape.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The non-atomic write is visible in two places. `src/app/api/outfits/[id]/route.ts` PATCH updates `outfits`, then `.from("outfit_items").delete()`, then `.insert()` — three round trips with no transaction, so a failed insert leaves the outfit with no composition. `src/app/api/outfits/route.ts` POST already hand-rolls a compensating `.from("outfits").delete()` when the membership insert fails, which is the symptom, not a fix. The accepted contract (ASTRA-OUT-1 above) says one authenticated SECURITY DEFINER transaction: read `.claude/skills/db-migration/SKILL.md` for the RPC pattern and Hard Rule #20 for why a plain RLS policy on `outfit_items` is the wrong lever. Client mutations to keep compatible: `useSaveOutfit()`/`useUpdateOutfit()` in `src/features/outfits/hooks.ts`. The named gate `tests/outfit-save.test.ts` does not exist yet — it is part of the deliverable. Hard Rules #24/#26: write the migration, hand the SQL to the owner, never apply it.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Create `tests/outfit-save.test.ts`: auth/validation, one atomic call, foreign garment, duplicate slot, failure and success. Owner isolated DB fixture proves rollback and concurrent composition; phone save→reopen checks existing response shape. Typecheck/lint.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/outfit-save.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Save outfit metadata and garment membership as one operation so failed edits preserve the old outfit.",
  "acceptance": [
    "One authenticated transaction validates garments, locks an existing outfit and writes metadata plus membership together.",
    "Any invalid garment or insertion failure preserves the original metadata/composition.",
    "Successful save retains current response shape, slot uniqueness and personal ownership."
  ],
  "scope": [
    "src/app/api/outfits/route.ts",
    "src/app/api/outfits/[id]/route.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/outfit-save.test.ts"
  ],
  "steps": [
    "Revalidate POST/PATCH contracts and ask for current owner function evidence; reuse an equivalent authenticated atomic function if one exists.",
    "Author the paired manual migration for one checked transaction using auth.uid(), fixed search path, garment ownership and existing slot constraints.",
    "Lock existing outfits before replacement; commit metadata and membership together or roll everything back, including create failure.",
    "Replace route-side sequential/compensating writes with one call while preserving Zod input, error mapping and returned row shape.",
    "Run route fixtures, then obtain owner isolated rollback/concurrency and phone reopen evidence separately; mocked RPC success is not atomicity proof."
  ],
  "invariants": [
    "No caller-supplied owner or household expansion.",
    "A failed A/[g1,g2]→B/[g2,bad] edit leaves A/[g1,g2] intact."
  ],
  "exclusions": [
    "Generic outfit service, image upload changes, garment deletion semantics and wear planner."
  ],
  "risks": [
    "Concurrent saves can mix composition unless locking covers the whole replace operation."
  ],
  "unknowns": [
    "Current DB function/grant evidence and owner application status; the named test suite is not present yet."
  ],
  "dependencies": [
    "Owner DB evidence before migration design; OUT-19 for phone/deployment witness"
  ],
  "risk": "high",
  "provenance": "2026-09-26 docs-grounded from retained ASTRA-OUT-1 and Outfits contracts. Revalidate sequential POST/PATCH writers before editing; no migration or transaction was applied.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-12

**Outcome:** Store outfit plans and reversible wear records.

- **Acceptance:** Migration C — `outfit_plans` (unique per user+date) + reversible `set_outfit_plan_worn` SECURITY DEFINER RPC, paired `schema.sql`; review the authored [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) runbook's locking and inverse assumptions before owner application. Current deployment is UNVERIFIED; do not silently amend the accepted wear-stat approximation.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** Review Overview §4's authored Migration C before copying it: its sample reads plan status without a row lock and reverses current outfit membership, so concurrency and composition edits require explicit handling. Preserve the accepted v1 approximation that last_worn_at is not rewound on Undo; a counter inverse is not a claim of exact timestamp restoration. Keep the plan as wear-history owner, define historical membership and deletion behavior, then author the paired migration/schema and owner-run isolated fixture. Current deployment remains unverified.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Review the authored SQL with explicit concurrent/replay traces, then propose `tests/outfit-wear-contract.test.ts`. Owner isolated SQL fixture must prove same-plan double mark, mark/unmark overlap, composition edits, foreign owner and rollback; migration application is a separate result.

**Scope notes:** Proposed paths: `tests/outfit-wear-contract.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Finish the outfit-plan and wear-record contract before handing a safe Migration C to the owner.",
  "acceptance": [
    "One personal plan per local date is enforced and worn history remains owned by that plan.",
    "The wear command authenticates, locks and updates plan/outfit/garment counters atomically with repeat-safe inverse behavior.",
    "Historical membership survives later outfit edits; the accepted last_worn_at-not-rewound approximation remains explicit rather than silently changed."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md",
    "migrations/",
    "migrations/schema.sql",
    "tests/outfit-wear-contract.test.ts"
  ],
  "steps": [
    "Compare Overview §4's authored Migration C against current schema and owner-supplied deployed functions; do not assume its example has been applied.",
    "Resolve the concrete gaps: row locking before status check, saved membership for the wear event, concurrent counter updates and plan/outfit deletion semantics.",
    "Record the smallest plan-owned history representation and inverse proof; retain the documented timestamp approximation unless the owner explicitly amends it.",
    "Author the reviewed migration/runbook first, then schema.sql; use authenticated identity, fixed search path and flat ownership/RPC protection rather than hot-child EXISTS policies.",
    "Separate local contract fixtures, owner isolated SQL proof and application status; this review alone does not complete the migration outcome."
  ],
  "invariants": [
    "No household sharing or new offline write queue.",
    "Repeated worn/unworn requests cannot increment or decrement another event's garments."
  ],
  "exclusions": [
    "Planner UI, AI suggestions, precise timestamp rewind and a generic wear-event framework."
  ],
  "risks": [
    "The authored example reads status without a lock and reverses current outfit membership, which can differ from what was worn."
  ],
  "unknowns": [
    "Current deployed state and reviewed historical-membership/deletion representation."
  ],
  "dependencies": [
    "OUT-20 composition contract",
    "Owner Outfits schema/function evidence"
  ],
  "risk": "high",
  "provenance": "2026-09-26 read Outfits Overview Migration C and schema.sql wardrobe/outfit tables. The authored RPC is a design source, not deployment evidence; locking/membership gaps require review.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-13

**Outcome:** Plan one outfit per day.

- **Acceptance:** OutfitPlannerCalendar (one-slot-per-day clone) + plans routes (409-upsert on date collision) + PlanOutfitSheet with the amber no-repeat banner ("Last worn … at …, worn N×"; warns, never blocks) → `src/components/web/WebMealPlanCalendar.tsx`
- **Depends on:** [OUT-12](<Outfits — Master Book.md#out-12>).

- **Acceptance:** dragging an outfit onto a day plans it; the "last worn" banner appears when applicable; a duplicate-date POST returns 409 and the client upserts.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Explicitly a clone of `src/components/web/WebMealPlanCalendar.tsx` — read `MealPlanCard`, `MealSlotCell` and `MealPlanDetailSheet` there for the week grid, the drag interaction and the detail sheet, and reduce to one slot per day. The Framer-Motion-versus-HTML5-drag rule bites here: never a `motion.div` with `draggable` (see `ERA Notes/01 - Architecture/Common Patterns.md`). New routes go beside `src/app/api/outfits/` with a 409 on date collision (Hard Rule #9) and the client upserting. Data comes from OUT-12's `outfit_plans`. Existing shared presets are in `src/lib/motion.ts`. The no-repeat banner warns and never blocks; Hard Rule #28 keeps it to one clause.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose `tests/outfit-plans.test.ts` and UI fixtures for create/drag/reopen, duplicate date→409 then update, local date/DST edges, owner isolation and failed writes. Check 390×844 and desktop drag/tap alternatives; typecheck/lint and Atlas.

**Scope notes:** Proposed paths: `src/app/api/outfits/plans/`, `src/components/outfits/OutfitPlannerCalendar.tsx`, `src/components/outfits/PlanOutfitSheet.tsx`, `tests/outfit-plans.test.ts`.

```delivery-plan-v1
{
  "outcome": "Plan one personal outfit per day through the existing Outfits app.",
  "acceptance": [
    "Dragging or selecting an outfit plans it on the chosen local date and reopens the saved plan.",
    "A date collision returns 409 and the client deliberately updates the existing plan without duplicates.",
    "The last-worn/no-repeat cue is concise and advisory; it never blocks planning."
  ],
  "scope": [
    "src/app/api/outfits/plans/",
    "src/components/outfits/OutfitPlannerCalendar.tsx",
    "src/components/outfits/PlanOutfitSheet.tsx",
    "src/components/outfits/OutfitsPage.tsx",
    "src/features/outfits/hooks.ts",
    "src/features/outfits/queryKeys.ts",
    "src/features/outfits/types.ts",
    "tests/outfit-plans.test.ts",
    "ERA Notes/04 - UI & Design/Page & Feature Atlas/"
  ],
  "steps": [
    "After OUT-12's schema contract, first deliver the scoped plans CRUD/types/hooks slice with auth, Zod, one-user/date uniqueness and explicit 409 handling.",
    "Adapt the existing meal-calendar interaction to one slot per day; reuse shared layout primitives without copying meal expansion or mixing motion.div with HTML5 drag.",
    "Add a compact Plan sheet and Planner navigation, preserving manual tap placement for phones and normal personal ownership.",
    "Surface the accepted last-worn/occasion/count cue and route any worn-state transition through OUT-12, never a plain status PATCH.",
    "Verify persistence, collision/retry, mobile navigation and each slice before marking the parent complete; update Atlas."
  ],
  "invariants": [
    "Date-only planning does not drift through UTC midnight conversion.",
    "A plan does not increment wear counters until the checked worn command runs."
  ],
  "exclusions": [
    "Weather integration, weekly auto-allocation, household wardrobe sharing and a new recurrence engine."
  ],
  "risks": [
    "Blindly retrying a colliding POST can overwrite the wrong day's choice; preserve explicit date identity."
  ],
  "unknowns": [
    "Final OUT-12 API contract and existing UI test harness; new routes/components/tests are proposed."
  ],
  "dependencies": [
    "OUT-12",
    "OUT-19 deployment/device evidence"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 planned from accepted Phase4 contract, Feature Map and current Outfits shape. The L-sized item is sequenced into API and UI slices; no Planner implementation is claimed.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-14

**Outcome:** Mark worn with a reversible history update.

- **Acceptance:** Mark-worn flow — status pill → RPC, Undo toast drives `p_worn=false`; wear stats surfaced on garments and outfits
- **Depends on:** [OUT-12](<Outfits — Master Book.md#out-12>), [OUT-13](<Outfits — Master Book.md#out-13>).

- **Acceptance:** mark-worn increments the outfit and item counters and Undo decrements them via `p_worn=false`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on OUT-12's `set_outfit_plan_worn` RPC and OUT-13's plan rows. The Undo shape already exists in this module — `useArchiveGarment()` and `useDeleteGarment()` in `src/features/outfits/hooks.ts` show the optimistic-mutation + toast pattern to copy, and Hard Rule #1 requires the Undo action with `ToastIcons` from `src/lib/toastIcons.tsx`. Undo must call the RPC with `p_worn=false` (a real inverse), not just invalidate the cache. Wear stats surface on `src/components/outfits/WardrobeGrid.tsx` and `OutfitsGallery.tsx`; cache invalidation follows `src/features/outfits/queryKeys.ts` (`outfitKeys`) — see `.claude/skills/cache-invalidation/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/outfit-mark-worn.test.ts`: mark twice, Undo twice, failed RPC, response loss, separate wear event, changed outfit membership and foreign user. Owner SQL fixture proves counters; phone reopen verifies grid/gallery refresh. Typecheck/lint.

**Scope notes:** Proposed paths: `src/app/api/outfits/plans/`, `src/components/outfits/OutfitPlannerCalendar.tsx`, `tests/outfit-mark-worn.test.ts`.

```delivery-plan-v1
{
  "outcome": "Mark a planned outfit worn and undo that specific wear through the checked domain command.",
  "acceptance": [
    "The status action invokes OUT-12's atomic wear command and updates the intended outfit/garment counters once.",
    "Undo calls p_worn=false for that exact plan/event and preserves unrelated wear history.",
    "Plan, garment and outfit views refresh consistently; last_worn_at retains the explicitly accepted v1 approximation."
  ],
  "scope": [
    "src/app/api/outfits/plans/",
    "src/features/outfits/hooks.ts",
    "src/features/outfits/queryKeys.ts",
    "src/components/outfits/OutfitPlannerCalendar.tsx",
    "src/components/outfits/WardrobeGrid.tsx",
    "src/components/outfits/OutfitsGallery.tsx",
    "tests/outfit-mark-worn.test.ts"
  ],
  "steps": [
    "Wait for OUT-12/13 and read the final worn/inverse response contract, including membership capture and conflicts.",
    "Wire the compact status action through safeFetch to the authenticated RPC boundary; never update counters or plan status independently.",
    "Return/use the plan or event identity for the toast's real Undo and expose failure without pretending the inverse succeeded.",
    "Invalidate the plan, outfit, garment and relevant history query keys after the authoritative result; keep manual planning available after errors.",
    "Verify repeat, failure and later-event cases plus phone save/reopen; distinguish counter reversal from the non-rewound last_worn_at field."
  ],
  "invariants": [
    "One accepted wear changes counts once; Undo cannot subtract a different event.",
    "No v1 offline queue or household expansion is introduced."
  ],
  "exclusions": [
    "Changing the accepted timestamp approximation, garment delete/restore and automatic wear detection."
  ],
  "risks": [
    "Using current outfit membership in Undo can decrement garments that were never worn; OUT-12 must solve this first."
  ],
  "unknowns": [
    "Final OUT-12 receipt/response shape and how its conflicts appear through the client."
  ],
  "dependencies": [
    "OUT-12",
    "OUT-13"
  ],
  "risk": "high",
  "provenance": "2026-09-26 reviewed authored wear RPC and existing Outfits mutation/Undo patterns. New plan routes/component and fixture scope depends on OUT-12/13; no wear mutation was executed.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-15

**Outcome:** AI try-on.

- **Acceptance:** AI try-on — photorealistic "me wearing this outfit" via Gemini image generation (sizing profile + cutouts as inputs)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked; nothing decided. If it restarts, the investigation starts at `src/lib/ai/gemini.ts` (`generateContentWithFallback`, `isDailyQuotaError`) for what the AI layer can actually do — note it is a text-generation path today, so image generation is a capability question to answer before design — plus OUT-7's `GenerateOptions` widening for passing cutouts as inputs, the sizing profile in `src/app/api/outfits/profile/route.ts` and `src/components/outfits/SizingProfileSheet.tsx`, and the stored cutouts reached through `src/features/outfits/useSignedUrls.ts`. Standing rule: AI proposes, the human confirms.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Produce a capability/privacy/cost matrix from current official provider documentation when the investigation is dispatched; use synthetic images only if separately authorized. Define failure and manual fallback examples; do not call a live image model in this planning packet.

```delivery-plan-v1
{
  "outcome": "Determine whether optional AI try-on is feasible within the accepted personal, free-tool wardrobe design.",
  "acceptance": [
    "Establish whether the existing allowed Gemini setup can accept the intended inputs and return images, with current limits and data handling.",
    "Clarify whether sizing data and garment cutouts are sufficient for the owner's expected 'me' representation; no body-photo collection is assumed.",
    "Record an adopt/defer decision and a bounded optional prototype plan; core wardrobe/builder use remains independent."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md"
  ],
  "steps": [
    "Inspect the current generation wrapper and OUT-7 input widening; distinguish image input support from image output capability.",
    "When dispatched, check current official provider capabilities, quota/cost and retention terms without enrolling a service or sending personal images.",
    "Ask the owner to confirm the minimum desired likeness/input and whether it fits locked D1/D2/D5; surface any required decision instead of silently reopening them.",
    "Define one opt-in synthetic-fixture prototype and deterministic fallback, with transient inputs, explicit image retention and no garment/plan mutations.",
    "Record the decision, evidence date and go/no-go conditions before any implementation or provider call."
  ],
  "invariants": [
    "Try-on is optional; the 2D builder stays the core workflow.",
    "No paid service, body rendering or personal-image upload is adopted by this investigation."
  ],
  "exclusions": [
    "New image backend, live model runs, automatic photo collection and claims of accurate fit."
  ],
  "risks": [
    "A visual approximation may look persuasive while misrepresenting fit, texture or the user's appearance."
  ],
  "unknowns": [
    "Current image-generation capability/cost, desired likeness/input, and allowed retention."
  ],
  "dependencies": [
    "OUT-7 if image input is used",
    "Owner decision on any departure from locked D1/D2/D5"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 read current Gemini text-response wrapper and Outfits locked decisions. No current external capability/pricing claim is made; official research belongs to the future bounded investigation.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-16

**Outcome:** AI outfit suggestions + weather-aware planning.

- **Acceptance:** AI outfit suggestions + weather-aware planning

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** `src/lib/prerequisites/evaluators/weather.ts` is an explicit stub returning unmet/not implemented. That establishes a missing evaluator, not ownership of a shared weather provider. First define the suggestion, location, freshness and privacy needs; only then choose the shared read seam and an authorized source. Suggestions consume personal garment tags and OUT-12/13 planning contracts, remain editable and never auto-save. Provider research/adoption is not implied by this parked item.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Define synthetic cases for hot/cold/rain, missing/stale forecast, unavailable provider, sparse tags and manual overrides. Verify suggestions never save plans automatically. Future provider comparisons use current official sources; this packet makes no network requests.

```delivery-plan-v1
{
  "outcome": "Define optional outfit suggestions and weather inputs without making manual planning depend on AI or a provider.",
  "acceptance": [
    "Clarify suggestion scope, intended day/location and how editable choices enter the existing planner.",
    "Weather availability, age and uncertainty are explicit; failure leaves manual wardrobe/planning usable.",
    "Any adopted suggestion uses authorized personal wardrobe data and requires confirmation before saving."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md"
  ],
  "steps": [
    "Inspect current garment tags and OUT-12/13 planning contracts; distinguish a useful deterministic filter from a new model call.",
    "Confirm the weather evaluator is a stub, then identify the proper shared read provider seam only after its consumers and location/privacy needs are agreed.",
    "Ask the owner about forecast source/location and the simplest desired suggestion; compare only authorized free options when future research is dispatched.",
    "Write one bounded read-only suggestion slice with known/unknown coverage, cache lifetime, stale-data fallback and editable confirmation into the existing planner."
  ],
  "invariants": [
    "The Prerequisites stub does not automatically own a shared weather service.",
    "No AI output or forecast creates, moves or marks an outfit worn."
  ],
  "exclusions": [
    "Provider adoption, location tracking, calendar rescheduling, paid calls and automatic planning."
  ],
  "risks": [
    "A stale forecast or an inferred location can make a confident clothing recommendation misleading."
  ],
  "unknowns": [
    "Desired suggestion criteria, allowed weather source/location, freshness and whether AI adds useful value."
  ],
  "dependencies": [
    "OUT-12",
    "OUT-13",
    "Owner weather/data-source decision"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 read src/lib/prerequisites/evaluators/weather.ts and Outfits tags/decisions: evaluator is an explicit stub. No live weather source was adopted or assumed; first slice is a product/data contract.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-17

**Outcome:** Trips packing-list bridge + cost-per-wear analytics bridge to Budget.

- **Acceptance:** Trips packing-list bridge + cost-per-wear analytics bridge to Budget

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked, and it is two unrelated bridges. Packing list: `src/features/trips/` and `src/components/trips/` own the packing list — Trips is a Junction module, so read its vault doc (`ERA Notes/03 - Junction Modules/Trips/`) before touching it. Cost-per-wear: needs a price on `wardrobe_items` (check `migrations/schema.sql` — it may not exist) and a read in `src/features/analytics/`. Both cross standalone boundaries, so the bridge code belongs in a junction surface or `src/lib/`, never as a cross-import between `src/features/outfits/` and `src/features/trips/`.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Prepare two separate fixture matrices: explicit garment→packing selection with no private-image leak or stock effects; cost-per-wear with missing price, zero wears, refund and currency basis. No money calculation is approved until its numerator/denominator are defined.

```delivery-plan-v1
{
  "outcome": "Separate the packing and cost-per-wear bridges into independently reviewable slices under the existing item.",
  "acceptance": [
    "Packing scope preserves personal wardrobe privacy and creates only explicitly selected trip-owned references/snapshots.",
    "Cost-per-wear defines purchase basis, currency, refunds and trustworthy wear-event counts before displaying money.",
    "Both bridges retain their own acceptance; completing one never closes OUT-17."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Outfits/Outfits — Master Book.md"
  ],
  "steps": [
    "Split the retained outcome into two named execution slices with Trips owning packing integration and Budget reviewing monetary semantics; keep the lifetime ID and checklist unchanged.",
    "For packing, inspect the TRIP-10 picker contract and define exactly which garment label/image data may be copied to a shared trip after explicit selection.",
    "For analytics, inventory wardrobe price fields and OUT-12/14 wear evidence; agree zero-wear, refund, currency and missing-price behavior with a worked example.",
    "Record the narrow source/target paths, privacy/inverse tests and dependencies for each slice after those decisions; use shared/junction integration rather than cross-standalone imports."
  ],
  "invariants": [
    "Personal wardrobe data does not become household-shared by joining through Trips.",
    "Cost-per-wear is an informational ratio, never a new transaction or balance event."
  ],
  "exclusions": [
    "Automatic packing, pricing provider, wardrobe sharing model and duplicate analytics implementation."
  ],
  "risks": [
    "The two bridges share a title but have different privacy, data and completion boundaries."
  ],
  "unknowns": [
    "Explicit packing disclosure fields; acquisition-price source/currency/refund meaning; reliable wear denominator."
  ],
  "dependencies": [
    "TRIP-10 or its authorized picker contract",
    "OUT-12",
    "OUT-14",
    "Budget money-basis review"
  ],
  "risk": "high",
  "provenance": "2026-09-26 checked schema.sql wardrobe fields: no acquisition-price field in the snapshot. Current wear counters are not a certified historical denominator; this plan preserves parked status as a split/design packet.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-21

**Outcome:** Resolve complete image signing above 100 garments.

- **Acceptance:** Held for DEC-08: reconcile the one-request requirement with a complete signed-URL result over100 images. Choose bounded batches or a genuine complete single response, then verify privacy and paging.
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

**Provenance:** [Outfits — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** DEC-08 remains the decision gate. Both layers cap coverage: signed-urls validates at most 100 paths, and useWardrobeImageUrls in `src/features/outfits/useSignedUrls.ts` sorts and silently slices its input to 100 before sending. A successful one-request trace can therefore hide missing images. The chosen complete-response/bounded-batch implementation must fix the client and server coherently, preserve personal URL scope/cache expiry and prove completeness above100.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** After DEC-08, propose `tests/outfit-signed-urls.test.ts`: 0/1/100/101/250 paths, duplicates, sorting, partial provider response, batch failure, expiry, logout/user change and private-path rejection. Confirm every requested visible image is resolved or explicitly failed; typecheck/lint.

**Scope notes:** Proposed paths: `tests/outfit-signed-urls.test.ts`.

```delivery-plan-v1
{
  "outcome": "Return complete private image coverage for large wardrobes under the approved request-count policy.",
  "acceptance": [
    "DEC-08 resolves bounded batches versus a genuinely complete single response; OUT-19's promise is amended only by that decision.",
    "More than 100 requested paths are never silently discarded.",
    "Signed results remain personal, deduplicated and correctly cached with truthful partial/error behavior."
  ],
  "scope": [
    "src/features/outfits/useSignedUrls.ts",
    "src/features/outfits/queryKeys.ts",
    "src/app/api/outfits/signed-urls/route.ts",
    "src/components/outfits/WardrobeGrid.tsx",
    "src/components/outfits/OutfitsGallery.tsx",
    "tests/outfit-signed-urls.test.ts"
  ],
  "steps": [
    "Record DEC-08 before editing; use the current client slice(0,100) and server max(100) as the reproducible incomplete-coverage case.",
    "Implement the chosen bounded batching or complete-response strategy without per-image request fan-out; validate every path against the current user.",
    "Key/cache by the complete authorized request identity and retain expiry margins; merge all results without treating a failed subset as a complete success.",
    "Handle user changes, reordered/duplicate inputs and newly visible images without leaking old viewer URLs or unnecessary refetching.",
    "Verify >100 coverage and phone network behavior, recording the updated owner-agreed request-count acceptance separately from code tests."
  ],
  "invariants": [
    "No household branch or public bucket.",
    "One request is not success if images beyond its cap disappear."
  ],
  "exclusions": [
    "New CDN, provider migration, bucket privacy changes and image-pipeline redesign."
  ],
  "risks": [
    "Fixing only the server cap leaves the client's slicing bug intact; fixing only slicing causes request validation failure."
  ],
  "unknowns": [
    "DEC-08 and the approved batch-size/concurrency/completeness contract."
  ],
  "dependencies": [
    "DEC-08",
    "OUT-19"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 rechecked useWardrobeImageUrls client slice and signed-urls max100. Proposed test suite targets the concrete lost-coverage boundary; no image URLs were generated.",
  "checks": [],
  "ownerReviewed": false
}
```

### OUT-22

**Outcome:** Resolve garment deletion and restoration.

- **Acceptance:** Held for DEC-09: decide archive/delete semantics and implement a real identity-preserving Undo with outfit membership/reference checks. OUT-20 atomic outfit save does not supply garment restoration.

**Provenance:** [Outfits — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** DEC-09 remains unresolved. The garment DELETE route removes the row and then storage objects; `useDeleteGarment()` in `src/features/outfits/hooks.ts` implements Undo by POSTing a new garment from cached metadata, without original ID or photos. This is a concrete identity/reference loss, not only a missing toast. Choose the lifecycle first, then preserve original ID/files and outfit/wear references through a checked inverse. Route comments about FK cascades are not live DB evidence; owner-supplied constraints are required.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** After DEC-09, propose `tests/garment-lifecycle.test.ts`: archive/delete/restore identity, original/cutout bytes, outfit memberships, repeat inverse, later edit, missing row, foreign owner and cleanup failure. Owner isolated FK/storage proof is separate from local tests.

**Scope notes:** Proposed paths: `tests/garment-lifecycle.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Make garment removal and restoration preserve the identity and references promised by the chosen lifecycle policy.",
  "acceptance": [
    "DEC-09 chooses archive/restore versus permanent deletion and specifies the real Undo boundary.",
    "A reversible removal restores the original garment ID, permitted files and membership/history relationships, never a replacement row.",
    "Permanent cleanup runs only after the accepted recovery/reference conditions and reports failures truthfully."
  ],
  "scope": [
    "src/app/api/outfits/items/[id]/route.ts",
    "src/features/outfits/hooks.ts",
    "src/components/outfits/GarmentDetailSheet.tsx",
    "src/features/outfits/types.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/garment-lifecycle.test.ts"
  ],
  "steps": [
    "Resolve DEC-09 and inspect current deployed FK/storage behavior; the current route comment is not evidence that membership cascades are safe.",
    "Define the smallest personal lifecycle transition using existing archive/restore patterns, with original ID, file retention and affected-reference checks.",
    "Replace the current delete Undo that POSTs a new garment with a checked inverse; preserve later edits and return truthful repeated/missing/conflict outcomes.",
    "Add only required migration/retention guards through a manual owner runbook; coordinate historical wear references with OUT-12 and composition with OUT-20.",
    "Verify DB identity, membership and both binaries through the full round-trip before permitting cleanup or claiming Undo works."
  ],
  "invariants": [
    "A recreated row without images is not identity-preserving restoration.",
    "No household expansion or v1 offline mutation queue."
  ],
  "exclusions": [
    "Choosing DEC-09 for the owner, broad media cleanup and generic recycle-system replacement."
  ],
  "risks": [
    "Current hard delete removes storage, while client Undo creates a new ID and loses photos/reference identity."
  ],
  "unknowns": [
    "DEC-09, current FK cascade behavior and history/file retention requirements."
  ],
  "dependencies": [
    "DEC-09",
    "OUT-20",
    "OUT-12 historical-reference contract where present"
  ],
  "risk": "high",
  "provenance": "2026-09-26 read garment DELETE and useDeleteGarment's recreating POST. This is a source-proven inverse gap; deployed constraints/storage and real-phone restoration remain unverified.",
  "checks": [],
  "ownerReviewed": false
}
```

## Shipped Log

- ✅ 2026-07-18 — **OUT-1** `outfits` standalone module scaffolded across all six index surfaces via `scripts/new-module.mjs`
- ✅ 2026-07-18 — **OUT-2** Migration A: `wardrobe_items` + `wardrobe_profiles` with flat `user_id = auth.uid()` RLS, paired `schema.sql`
- ✅ 2026-07-18 — **OUT-3** `wardrobeImage.ts` — a WebP/alpha-preserving compressor (the JPEG receipt compressor flattens alpha and must never be reused here)
- ✅ 2026-07-18 — **OUT-4** `backgroundRemoval.ts` — lazily-imported `@imgly/background-removal`, webp-alpha output re-compressed to 800 px
- ✅ 2026-07-18 — **OUT-5** garment + profile CRUD routes, image upload (2 MB cap, private `wardrobe` bucket, paths-in-DB, rollback) and a batch signed-URLs endpoint (≤100 paths, owner-only)
- ✅ 2026-07-18 — **OUT-6** wardrobe UI: feature dir (queryKeys/hooks/`useSignedUrls` with 50-min cache), `WardrobeGrid` + filters, 3-step `AddGarmentSheet`, `GarmentDetailSheet`, `SizingProfileSheet`
- ✅ 2026-07-18 — **OUT-9** Migration B: `outfits` + `outfit_items` junction (denormalized `user_id`, `UNIQUE(outfit_id, slot)`), paired `schema.sql`
- ✅ 2026-07-18 — **OUT-10** outfits CRUD with `outfit_items(*)` embed + `OutfitBuilder` (stacked `SlotSwiper` rows, overlays) + `SaveOutfitSheet` + `OutfitsGallery`
- ✅ 2026-07-18 — **OUT-11** garment archive/delete shows a "used in N outfits" warning via the junction reverse lookup
- ✅ 2026-07-19 — **OUT-18** standalone installable PWA: own manifest (`/manifests/outfits.webmanifest`, id `/outfits-app`, scope `/outfits`), generated icons, layout metadata, wired into `scripts/generate-icons.cjs`. The same pass added Healthcare + ERA manifests/icons/layouts. *(These three plus PM cannot install on-device until the root `manifest.json` `scope: "/"` collision is resolved.)*
- ✅ 2026-07-19 — on-device background removal fixed after the real-phone test — see the CSP case study below

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.

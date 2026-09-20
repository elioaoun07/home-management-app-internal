---
created: 2026-09-10
updated: 2026-09-10
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

### OUT-19

**Outcome:** Verify Outfits deployment, privacy and both-phone behavior.

- **Acceptance:** *(bundled into the Phase-0 owner day, packet **E-00**, of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>) — its pass/fail gates whether **M-08**/OUT-7 runs in Phase 3)* (Phase 1) Real-phone acceptance: owner verifies core migration APPLIED evidence and applies only missing reviewed SQL, then photo → cutout → tagged garment in the grid in under a minute with ONE batch signed-URL request per screen; measure the first-use model download on a real network

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-executed phone acceptance; no code change. What to read so you can interpret the result: the migration files under `migrations/` for the Outfits tables (`wardrobe_items`, `wardrobe_profiles`, `outfits`, `outfit_items`) and their end state in `migrations/schema.sql` — and per Hard Rule #27, `migrations/db-state.json` is the only repo artifact that is evidence about RLS. The one-batch signed-URL claim is measurable in `src/features/outfits/useSignedUrls.ts` (`useWardrobeImageUrls`) against `src/app/api/outfits/signed-urls/route.ts`, whose Zod body caps `paths` at 100 — the same cap OUT-21 is held on. The capture path is `src/components/outfits/AddGarmentSheet.tsx` plus `useCreateGarment()`/`useUploadGarmentImages()` in `src/features/outfits/hooks.ts`. Agents never apply the SQL (Hard Rule #26).

### OUT-7

**Outcome:** Expand outfit generation parts.

- **Acceptance:** *(packet **M-08** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #2, only runs if OUT-19 passed)* (Phase 2) Widen `GenerateOptions` parts to accept `inlineData` image parts (non-breaking; repo-wide typecheck is the proof) → `src/lib/ai/gemini.ts`
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small and precisely located: `src/lib/ai/gemini.ts`, the `GenerateOptions` interface — `contents: Array<{ role: "user" | "model"; parts: { text: string }[] }>` (verified 2026-09-20). Widening `parts` to a union that also accepts `inlineData` is the change; `generateContentWithFallback()` in the same file is the consumer, and every other caller in `src/lib/ai/` and `src/app/api/ai-chat/` must still compile — a repo-wide `pnpm typecheck` is literally the acceptance. Do not change the fallback-model or 429 discrimination logic while you are in there.

### OUT-8

**Outcome:** Offer editable AI garment tags.

- **Acceptance:** `tag-garment` route (enum-constrained JSON via `generateContentWithFallback`, Zod-parsed, 429→cooldown) + Auto-tag button with `timeoutMs: 60_000` pre-filling editable form fields
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

- **Acceptance:** auto-tag pre-fill works end-to-end into editable fields; a forced 429 shows the cooldown toast with manual tagging unaffected; a repo-wide typecheck proves no existing Gemini caller regressed.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** New route beside the existing ones in `src/app/api/outfits/`; follow `.claude/skills/api-route/SKILL.md` and copy the auth → Zod → DB → error-mapping shape from `src/app/api/outfits/items/route.ts`. The model call is `generateContentWithFallback()` in `src/lib/ai/gemini.ts`, with `isDailyQuotaError()` for the 429→cooldown discrimination; depends on OUT-7 if the request carries an image part. Client side: the form is `src/components/outfits/AddGarmentSheet.tsx` and the mutation neighbours are in `src/features/outfits/hooks.ts` (`useCreateGarment`, `useUpdateGarment`). Hard Rule #6 — an AI call must pass `timeoutMs: 60_000` to `safeFetch()` or it aborts at 8 s. Fields stay editable: AI proposes, the human confirms.

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

### OUT-12

**Outcome:** Store outfit plans and reversible wear records.

- **Acceptance:** Migration C — `outfit_plans` (unique per user+date) + reversible `set_outfit_plan_worn` SECURITY DEFINER RPC, paired `schema.sql`; review the authored [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) runbook's locking and inverse assumptions before owner application. Current deployment is UNVERIFIED; do not silently amend the accepted wear-stat approximation.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Migration-only, and it is the prerequisite for OUT-13/OUT-14. Read `migrations/schema.sql` for the existing Outfits tables before adding `outfit_plans`, and the authored runbook in `ERA Notes/02 - Standalone Modules/Outfits/Overview.md` §4 for its locking and inverse assumptions. The reversible RPC is the interesting part: `set_outfit_plan_worn` must be a true inverse (`p_worn=false` restores the prior counters), which is `.claude/skills/data-repair/SKILL.md` discipline applied to a function. Hard Rule #20 — enforce access inside the SECURITY DEFINER function, not with an EXISTS policy on a child table — and #24: migration file first, then `schema.sql`, then hand it to the owner. Deployment of the earlier migrations is UNVERIFIED; check `migrations/db-state.json` before assuming a table exists.

### OUT-13

**Outcome:** Plan one outfit per day.

- **Acceptance:** OutfitPlannerCalendar (one-slot-per-day clone) + plans routes (409-upsert on date collision) + PlanOutfitSheet with the amber no-repeat banner ("Last worn … at …, worn N×"; warns, never blocks) → `src/components/web/WebMealPlanCalendar.tsx`
- **Depends on:** [OUT-12](<Outfits — Master Book.md#out-12>).

- **Acceptance:** dragging an outfit onto a day plans it; the "last worn" banner appears when applicable; a duplicate-date POST returns 409 and the client upserts.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Explicitly a clone of `src/components/web/WebMealPlanCalendar.tsx` — read `MealPlanCard`, `MealSlotCell` and `MealPlanDetailSheet` there for the week grid, the drag interaction and the detail sheet, and reduce to one slot per day. The Framer-Motion-versus-HTML5-drag rule bites here: never a `motion.div` with `draggable` (see `ERA Notes/01 - Architecture/Common Patterns.md`). New routes go beside `src/app/api/outfits/` with a 409 on date collision (Hard Rule #9) and the client upserting. Data comes from OUT-12's `outfit_plans`. Existing shared presets are in `src/lib/motion.ts`. The no-repeat banner warns and never blocks; Hard Rule #28 keeps it to one clause.

### OUT-14

**Outcome:** Mark worn with a reversible history update.

- **Acceptance:** Mark-worn flow — status pill → RPC, Undo toast drives `p_worn=false`; wear stats surfaced on garments and outfits
- **Depends on:** [OUT-12](<Outfits — Master Book.md#out-12>), [OUT-13](<Outfits — Master Book.md#out-13>).

- **Acceptance:** mark-worn increments the outfit and item counters and Undo decrements them via `p_worn=false`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on OUT-12's `set_outfit_plan_worn` RPC and OUT-13's plan rows. The Undo shape already exists in this module — `useArchiveGarment()` and `useDeleteGarment()` in `src/features/outfits/hooks.ts` show the optimistic-mutation + toast pattern to copy, and Hard Rule #1 requires the Undo action with `ToastIcons` from `src/lib/toastIcons.tsx`. Undo must call the RPC with `p_worn=false` (a real inverse), not just invalidate the cache. Wear stats surface on `src/components/outfits/WardrobeGrid.tsx` and `OutfitsGallery.tsx`; cache invalidation follows `src/features/outfits/queryKeys.ts` (`outfitKeys`) — see `.claude/skills/cache-invalidation/SKILL.md`.

### OUT-15

**Outcome:** AI try-on.

- **Acceptance:** AI try-on — photorealistic "me wearing this outfit" via Gemini image generation (sizing profile + cutouts as inputs)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked; nothing decided. If it restarts, the investigation starts at `src/lib/ai/gemini.ts` (`generateContentWithFallback`, `isDailyQuotaError`) for what the AI layer can actually do — note it is a text-generation path today, so image generation is a capability question to answer before design — plus OUT-7's `GenerateOptions` widening for passing cutouts as inputs, the sizing profile in `src/app/api/outfits/profile/route.ts` and `src/components/outfits/SizingProfileSheet.tsx`, and the stored cutouts reached through `src/features/outfits/useSignedUrls.ts`. Standing rule: AI proposes, the human confirms.

### OUT-16

**Outcome:** AI outfit suggestions + weather-aware planning.

- **Acceptance:** AI outfit suggestions + weather-aware planning

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked; there is no live weather source. `src/lib/prerequisites/evaluators/weather.ts` exists but is an explicit stub that always returns `met: false` with "not yet implemented" (verified 2026-09-20), and it is registered in `src/lib/prerequisites/evaluators/index.ts` — so it is the natural place to land a real provider, and Prerequisites would benefit too. Choosing and authorizing that provider is the first investigation step, not an implementation detail. The suggestion half would build on `src/lib/ai/gemini.ts` and the garment/outfit reads in `src/features/outfits/hooks.ts`; the planning half depends on OUT-12/OUT-13 existing.

### OUT-17

**Outcome:** Trips packing-list bridge + cost-per-wear analytics bridge to Budget.

- **Acceptance:** Trips packing-list bridge + cost-per-wear analytics bridge to Budget

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked, and it is two unrelated bridges. Packing list: `src/features/trips/` and `src/components/trips/` own the packing list — Trips is a Junction module, so read its vault doc (`ERA Notes/03 - Junction Modules/Trips/`) before touching it. Cost-per-wear: needs a price on `wardrobe_items` (check `migrations/schema.sql` — it may not exist) and a read in `src/features/analytics/`. Both cross standalone boundaries, so the bridge code belongs in a junction surface or `src/lib/`, never as a cross-import between `src/features/outfits/` and `src/features/trips/`.

### OUT-21

**Outcome:** Resolve complete image signing above 100 garments.

- **Acceptance:** Held for DEC-08: reconcile the one-request requirement with a complete signed-URL result over100 images. Choose bounded batches or a genuine complete single response, then verify privacy and paging.
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

**Provenance:** [Outfits — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-08; the conflict is exact and verifiable. `src/app/api/outfits/signed-urls/route.ts` validates `paths: z.array(z.string().min(1).max(300)).min(1).max(100)` — so a 101st garment cannot be signed in the one request OUT-19 requires. The caller is `useWardrobeImageUrls()` in `src/features/outfits/useSignedUrls.ts`, consumed by `src/components/outfits/WardrobeGrid.tsx` and `OutfitsGallery.tsx`; whichever way DEC-08 goes (bounded batches or a genuinely complete response), that hook is where paging or batching lands. Record the decision in `_Decisions.md` first.

### OUT-22

**Outcome:** Resolve garment deletion and restoration.

- **Acceptance:** Held for DEC-09: decide archive/delete semantics and implement a real identity-preserving Undo with outfit membership/reference checks. OUT-20 atomic outfit save does not supply garment restoration.

**Provenance:** [Outfits — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-09, and both semantics already exist side by side in `src/app/api/outfits/items/[id]/route.ts`: PATCH takes `archived: boolean` and sets/clears `archived_at`, while DELETE hard-deletes the row *and* cleans up storage objects. That storage cleanup is why today's delete cannot be undone — identity-preserving restore has to survive it. Client mutations: `useArchiveGarment()` and `useDeleteGarment()` in `src/features/outfits/hooks.ts`; the list filter is the `includeArchived` argument on `useWardrobeItems()`. Membership/reference checks mean `outfit_items` rows pointing at the garment — see OUT-20 for how that table is written. Compare with the app-wide precedent in `src/features/recycle-bin/` before inventing a third model. OUT-20 does not supply this.

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

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

### OUT-7

**Outcome:** Expand outfit generation parts.

- **Acceptance:** *(packet **M-08** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #2, only runs if OUT-19 passed)* (Phase 2) Widen `GenerateOptions` parts to accept `inlineData` image parts (non-breaking; repo-wide typecheck is the proof) → `src/lib/ai/gemini.ts`
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-8

**Outcome:** Offer editable AI garment tags.

- **Acceptance:** `tag-garment` route (enum-constrained JSON via `generateContentWithFallback`, Zod-parsed, 429→cooldown) + Auto-tag button with `timeoutMs: 60_000` pre-filling editable form fields
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

- **Acceptance:** auto-tag pre-fill works end-to-end into editable fields; a forced 429 shows the cooldown toast with manual tagging unaffected; a repo-wide typecheck proves no existing Gemini caller regressed.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-20

**Outcome:** Save outfits and membership atomically.

- **Acceptance:** Save an outfit and its garment membership atomically so a failed edit preserves the previous composition.

**Retained contract — ASTRA-OUT-1:**

- **Outcome:** A rejected or failed save leaves the previous outfit metadata and composition intact.
- **Boundary:** Keep existing Zod/response contract. One authenticated transaction validates all garments, updates/creates metadata and replaces composition; lock an existing outfit before replacement. Enforce the authenticated owner inside the boundary, never a caller-supplied owner or household expansion. Failure rolls back all writes. Preserve slot uniqueness and existing deletion semantics. Reuse a current equivalent DB function if owner evidence reveals one. Do not add a generic outfit service or change image upload.
- **Money/schedule math?:** No. Integrity fixture: saved metadata A with garments [g1,g2] + invalid g3 or injected insert failure → metadata A and [g1,g2] remain; valid save B/[g2,g4] → both change together. Foreign-owner garments fail without mutation.
- **Gate:** `pnpm exec vitest run tests/outfit-save.test.ts --reporter=verbose` → nonzero route cases for auth, validation, one atomic call, failure and success pass; common gates. Owner-run DB transaction/concurrent-save fixture from the migration must separately prove rollback, scope and no mixed composition. A mock RPC success does not prove atomicity. OUT-19 phone save→reopen capture at390×844 demonstrates the preserved response shape.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-12

**Outcome:** Store outfit plans and reversible wear records.

- **Acceptance:** Migration C — `outfit_plans` (unique per user+date) + reversible `set_outfit_plan_worn` SECURITY DEFINER RPC, paired `schema.sql`; review the authored [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) runbook's locking and inverse assumptions before owner application. Current deployment is UNVERIFIED; do not silently amend the accepted wear-stat approximation.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-13

**Outcome:** Plan one outfit per day.

- **Acceptance:** OutfitPlannerCalendar (one-slot-per-day clone) + plans routes (409-upsert on date collision) + PlanOutfitSheet with the amber no-repeat banner ("Last worn … at …, worn N×"; warns, never blocks) → `src/components/web/WebMealPlanCalendar.tsx`
- **Depends on:** [OUT-12](<Outfits — Master Book.md#out-12>).

- **Acceptance:** dragging an outfit onto a day plans it; the "last worn" banner appears when applicable; a duplicate-date POST returns 409 and the client upserts.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-14

**Outcome:** Mark worn with a reversible history update.

- **Acceptance:** Mark-worn flow — status pill → RPC, Undo toast drives `p_worn=false`; wear stats surfaced on garments and outfits
- **Depends on:** [OUT-12](<Outfits — Master Book.md#out-12>), [OUT-13](<Outfits — Master Book.md#out-13>).

- **Acceptance:** mark-worn increments the outfit and item counters and Undo decrements them via `p_worn=false`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-15

**Outcome:** AI try-on.

- **Acceptance:** AI try-on — photorealistic "me wearing this outfit" via Gemini image generation (sizing profile + cutouts as inputs)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-16

**Outcome:** AI outfit suggestions + weather-aware planning.

- **Acceptance:** AI outfit suggestions + weather-aware planning

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-17

**Outcome:** Trips packing-list bridge + cost-per-wear analytics bridge to Budget.

- **Acceptance:** Trips packing-list bridge + cost-per-wear analytics bridge to Budget

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### OUT-21

**Outcome:** Resolve complete image signing above 100 garments.

- **Acceptance:** Held for DEC-08: reconcile the one-request requirement with a complete signed-URL result over100 images. Choose bounded batches or a genuine complete single response, then verify privacy and paging.
- **Depends on:** [OUT-19](<Outfits — Master Book.md#out-19>).

**Provenance:** [Outfits — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>). The source is historical; this entry owns the retained outcome.

### OUT-22

**Outcome:** Resolve garment deletion and restoration.

- **Acceptance:** Held for DEC-09: decide archive/delete semantics and implement a real identity-preserving Undo with outfit membership/reference checks. OUT-20 atomic outfit save does not supply garment restoration.

**Provenance:** [Outfits — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Outfits/Outfits — Master Book.md>). The source is historical; this entry owns the retained outcome.

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

---
created: 2026-07-17
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/outfits
---

# Outfits · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why and in what order* for the Outfits build — four phases, each an independently shippable PR in vertical-slice order (DB → API → types → hooks → UI). The checkable version is [4 · Checklist](<4 - Checklist.md>). The full design (DDL, pipeline, UI spec, STOP conditions) is [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>) — **implementing agents read its §10 first.**

---

## The Call

**Ship the catalog first; the paper doll is worthless until clothes are digitized.**

The entire module hinges on one loop being pleasant: photo → cutout → tagged garment in under a minute. That is Phase 1 and it carries all the infrastructure (bucket, pipeline, batch signed URLs). Everything after it is composition and bookkeeping on top of already-clean data. AI (Phase 2) is deliberately an *accelerator* on manual tagging, never a dependency — quota exhaustion must cost zero functionality. The planner (Phase 4) is last because it is the most template-derived (meal-plan clone) and needs outfits to exist.

---

## The Sequence

**Phase 1 — Wardrobe catalog** *(OUT-1 … OUT-6)*
Scaffold via `scripts/new-module.mjs` (six index surfaces). Migration A (`wardrobe_items`, `wardrobe_profiles`, flat RLS) paired with `schema.sql`. New libs `wardrobeImage.ts` (WebP/alpha compressor — **never** reuse the JPEG receipt compressor) and `backgroundRemoval.ts` (lazy-imported `@imgly/background-removal`). CRUD + images + batch signed-URLs routes cloned from the catalogue/receipt templates. WardrobeGrid, 3-step AddGarmentSheet (manual tags only), GarmentDetailSheet, SizingProfileSheet.
**DoD:** on a phone — photograph a garment → approve cutout → save with manual tags → it appears in the filtered grid via ONE batch signed-URL call; archive works with Undo; `finish-task` clean; migration paired; six surfaces + Atlas registered.

**Phase 2 — AI auto-tag** *(OUT-7 … OUT-8)*
Widen `gemini.ts` parts for `inlineData` (non-breaking). `tag-garment` route through `generateContentWithFallback` returning enum-constrained JSON, Zod-parsed. Auto-tag button (`safeFetch` + `timeoutMs: 60_000`) pre-fills **editable** form fields.
**DoD:** pre-fill works end-to-end; a forced 429 shows the cooldown toast and manual tagging is unaffected; repo-wide typecheck proves no existing Gemini caller regressed.

**Phase 3 — Outfit builder** *(OUT-9 … OUT-11)*
Migration B (`outfits` + `outfit_items` junction, denormalized `user_id`, one-garment-per-slot). Outfits CRUD with `outfit_items(*)` embed. OutfitBuilder + SlotSwiper (per-slot snap-scroll) + SaveOutfitSheet + OutfitsGallery. "Used in N outfits" warning on garment archive/delete.
**DoD:** compose by swiping slots, save, reopen/edit; gallery thumbnails compose correctly; deleting a used garment warns and cascades cleanly.

**Phase 4 — Planner + wear log** *(OUT-12 … OUT-14)*
Migration C (`outfit_plans`, unique per day, + reversible `set_outfit_plan_worn` RPC). Plans routes (409-upsert on date collision). OutfitPlannerCalendar (meal-plan clone, one row). PlanOutfitSheet with the no-repeat banner. Mark-worn with Undo driving `p_worn=false`.
**DoD:** drag-plan an outfit onto a day; the "last worn" banner appears when applicable; mark-worn increments outfit + item counters and Undo decrements them; duplicate-date POST returns 409 and the client upserts.

---

## STOP conditions (for any implementing agent — full list in Overview §10)

> ⚠️ STOP and re-read the Overview if you are about to: reuse `compressReceiptImage` for cutouts (JPEG flattens alpha) · top-level-import `@imgly/background-removal` · store base64 or signed URLs in DB columns · join `household_links` in any outfits route · write an EXISTS-subquery RLS policy · let AI write tags without user confirmation · call `tag-garment` without `timeoutMs: 60_000` · ship a toast without Undo.

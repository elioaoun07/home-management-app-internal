---
created: 2026-07-17
updated: 2026-07-18
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/outfits
---

# Outfits · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable queue for the Outfits build. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). **Implementing agents: read [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>) §10 (STOP conditions) before starting ANY item.** Phases are PR-sized vertical slices — finish a phase's items together and stamp [1 · Feature State](<1 - Feature State.md>).
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.

---

## Now

**Phase 1 — Wardrobe catalog** — the whole loop: photo → cutout → tagged garment → grid. Carries all infrastructure.

- [x] **OUT-1** (Phase 1) Scaffold the `outfits` standalone module (six index surfaces: feature dir, API route, page, Feature Map, vault doc row, Atlas) via dry-run-first `node scripts/new-module.mjs --name outfits --type standalone` → `scripts/new-module.mjs` _(blocker - S)_
- [x] **OUT-2** (Phase 1) Migration A — `wardrobe_items` + `wardrobe_profiles` with flat `user_id = auth.uid()` RLS, paired `schema.sql` end state; DDL verbatim from [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) → `migrations/schema.sql` _(blocker - S)_
- [x] **OUT-3** (Phase 1) New WebP/alpha-preserving compressor **wardrobeImage.ts** in src/lib (clone the quality-ladder shape only — NEVER reuse the JPEG receipt compressor, it flattens alpha) → `src/lib/receiptUtils.ts` _(blocker - M)_
- [x] **OUT-4** (Phase 1) New **backgroundRemoval.ts** in src/lib — lazy `await import("@imgly/background-removal")` (never top-level), webp-alpha output re-compressed to 800px; add the runtime dependency → `package.json` _(blocker - M)_
- [x] **OUT-5** (Phase 1) Garment + profile CRUD routes, images upload route (2 MB cap, private `wardrobe` bucket, paths-in-DB, rollback) cloned from the catalogue template, plus batch signed-URLs endpoint (≤100 paths, owner-only, bulk `createSignedUrls`) → `src/app/api/catalogue/items/[id]/document-image/route.ts` _(blocker - M)_
- [x] **OUT-6** (Phase 1) Wardrobe UI — feature dir (queryKeys/hooks/useSignedUrls w/ 50-min cache), WardrobeGrid + filters, 3-step AddGarmentSheet (capture cloned from receipt sheet; flat-lay guidance; cutout approve / "Keep original" fallback; manual tags), GarmentDetailSheet, SizingProfileSheet (decimal text inputs) → `src/components/expense/ReceiptSheet.tsx` _(blocker - L)_

## Next

**Phase 2 — AI auto-tag** — accelerator on manual tagging; quota exhaustion must cost zero functionality.

- [ ] **OUT-7** (Phase 2) Widen `GenerateOptions` parts to accept `inlineData` image parts (non-breaking; repo-wide typecheck is the proof) → `src/lib/ai/gemini.ts` _(friction - S)_
- [ ] **OUT-8** (Phase 2) `tag-garment` route (enum-constrained JSON via `generateContentWithFallback`, Zod-parsed, 429→cooldown) + Auto-tag button with `timeoutMs: 60_000` pre-filling editable form fields _(friction - M)_

**Phase 3 — Outfit builder** — the paper doll.

- [x] **OUT-9** (Phase 3) Migration B — `outfits` + `outfit_items` junction (denormalized `user_id`, `UNIQUE(outfit_id, slot)`), paired `schema.sql`; DDL verbatim from [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) _(blocker - S)_
- [x] **OUT-10** (Phase 3) Outfits CRUD with `outfit_items(*)` embed + OutfitBuilder (stacked SlotSwiper snap-scroll rows, outerwear/accessory overlays) + SaveOutfitSheet + OutfitsGallery (mini composed stacks) _(blocker - L)_
- [x] **OUT-11** (Phase 3) Garment archive/delete shows "used in N outfits" warning via the junction reverse lookup _(friction - S)_

## Later

**Phase 4 — Planner + wear log** — the functional payoff: plan the week, never repeat an event outfit.

- [ ] **OUT-12** (Phase 4) Migration C — `outfit_plans` (unique per user+date) + reversible `set_outfit_plan_worn` SECURITY DEFINER RPC, paired `schema.sql`; DDL verbatim from [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) _(blocker - S)_
- [ ] **OUT-13** (Phase 4) OutfitPlannerCalendar (one-slot-per-day clone) + plans routes (409-upsert on date collision) + PlanOutfitSheet with the amber no-repeat banner ("Last worn … at …, worn N×"; warns, never blocks) → `src/components/web/WebMealPlanCalendar.tsx` _(blocker - L)_
- [ ] **OUT-14** (Phase 4) Mark-worn flow — status pill → RPC, Undo toast drives `p_worn=false`; wear stats surfaced on garments and outfits _(friction - M)_

**Vision backlog** — see [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) for the full list; queue as parked so they stay visible.

- [ ] **OUT-15** AI try-on — photorealistic "me wearing this outfit" via Gemini image generation (sizing profile + cutouts as inputs) _(parked - L)_
- [ ] **OUT-16** AI outfit suggestions + weather-aware planning _(parked - L)_
- [x] **OUT-18** Standalone installable PWA — own manifest (`/manifests/outfits.webmanifest`, id `/outfits-app`, scope `/outfits`), icons generated from new `outfits-icon.svg`, layout manifest/apple metadata; wired into `scripts/generate-icons.cjs` → `src/app/outfits/layout.tsx` *(IMPLEMENTED 2026-07-19 — same pass added Healthcare + ERA manifests/icons/layouts + nav-hide wiring. NOTE: these three plus PM cannot install on-device until the root `manifest.json` `scope:"/"` collision is resolved.)* _(annoyance - S)_
- [ ] **OUT-17** Trips packing-list bridge + cost-per-wear analytics bridge to Budget _(parked - M)_

## Definition of Done

- **D1** Every phase ends with the `finish-task` skill: typecheck/lint clean, migration↔schema.sql paired, Atlas current, this checklist ticked and [1 · Feature State](<1 - Feature State.md>) stamped.
- **D2** Phase 1 acceptance on a real phone: photo → cutout → tagged garment in the grid in under a minute, with ONE batch signed-URL request per screen.
- **D3** No STOP condition from [Overview §10](<../../02 - Standalone Modules/Outfits/Overview.md>) violated (alpha-flattening compressor, top-level imgly import, base64/URLs in DB, household joins, EXISTS RLS, unconfirmed AI writes, missing `timeoutMs`, Undo-less toasts).

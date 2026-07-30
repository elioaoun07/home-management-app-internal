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

> **Campaign:** [Outfits — Master Book](<Outfits — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable queue for the Outfits build. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). **Implementing agents: read [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>) §10 (STOP conditions) before starting ANY item.** Phases are PR-sized vertical slices — finish a phase's items together and stamp [Outfits — Master Book](<Outfits — Master Book.md>).
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.

---

## Now

**Phase 1 — Wardrobe catalog** *(shipped 2026-07-18 — OUT-1…OUT-6 swept to the Master Book's Shipped Log)*

- [ ] **OUT-19** (Phase 1) Real-phone acceptance: run the core migration, then photo → cutout → tagged garment in the grid in under a minute with ONE batch signed-URL request per screen; measure the first-use model download on a real network _(blocker - S)_

## Next

**Phase 2 — AI auto-tag** — accelerator on manual tagging; quota exhaustion must cost zero functionality.

- [ ] **OUT-7** (Phase 2) Widen `GenerateOptions` parts to accept `inlineData` image parts (non-breaking; repo-wide typecheck is the proof) → `src/lib/ai/gemini.ts` _(friction - S)_
- [ ] **OUT-8** (Phase 2) `tag-garment` route (enum-constrained JSON via `generateContentWithFallback`, Zod-parsed, 429→cooldown) + Auto-tag button with `timeoutMs: 60_000` pre-filling editable form fields _(friction - M)_

**Phase 3 — Outfit builder** *(shipped 2026-07-18 — OUT-9…OUT-11 swept to the Master Book's Shipped Log)*

## Later

**Phase 4 — Planner + wear log** — the functional payoff: plan the week, never repeat an event outfit.

- [ ] **OUT-12** (Phase 4) Migration C — `outfit_plans` (unique per user+date) + reversible `set_outfit_plan_worn` SECURITY DEFINER RPC, paired `schema.sql`; DDL verbatim from [Overview §4](<../../02 - Standalone Modules/Outfits/Overview.md>) _(blocker - S)_
- [ ] **OUT-13** (Phase 4) OutfitPlannerCalendar (one-slot-per-day clone) + plans routes (409-upsert on date collision) + PlanOutfitSheet with the amber no-repeat banner ("Last worn … at …, worn N×"; warns, never blocks) → `src/components/web/WebMealPlanCalendar.tsx` _(blocker - L)_
- [ ] **OUT-14** (Phase 4) Mark-worn flow — status pill → RPC, Undo toast drives `p_worn=false`; wear stats surfaced on garments and outfits _(friction - M)_

**Vision backlog** — the full list lives in the Master Book's dream backlog; queued here as parked so they stay visible.

- [ ] **OUT-15** AI try-on — photorealistic "me wearing this outfit" via Gemini image generation (sizing profile + cutouts as inputs) _(parked - L)_
- [ ] **OUT-16** AI outfit suggestions + weather-aware planning _(parked - L)_
- [ ] **OUT-17** Trips packing-list bridge + cost-per-wear analytics bridge to Budget _(parked - M)_

## Definition of Done

- **D1** Every phase ends with the `finish-task` skill: typecheck/lint clean, migration↔schema.sql paired, Atlas current, this checklist ticked and [Outfits — Master Book](<Outfits — Master Book.md>) stamped.
- **D2** Phase 1 acceptance on a real phone: photo → cutout → tagged garment in the grid in under a minute, with ONE batch signed-URL request per screen.
- **D3** No STOP condition from [Overview §10](<../../02 - Standalone Modules/Outfits/Overview.md>) violated (alpha-flattening compressor, top-level imgly import, base64/URLs in DB, household joins, EXISTS RLS, unconfirmed AI writes, missing `timeoutMs`, Undo-less toasts).

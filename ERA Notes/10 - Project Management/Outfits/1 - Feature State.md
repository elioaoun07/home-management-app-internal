---
created: 2026-07-17
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/outfits
---

# Outfits · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the _honest, no-hype_ state of every Outfits sub-feature. **Greenfield module (2026-07-17): nothing is implemented.** The design, however, is complete and owner-locked — see [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>). As phases ship, stamp items here `✅ YYYY-MM-DD` per [_Conventions](<../_Conventions.md>) §3.

---

## Maturity tiers

| Tier                  | Meaning                                                     |
| --------------------- | ----------------------------------------------------------- |
| 🟢 **Core**           | Battle-tested, used daily.                                  |
| 🔵 **Established**    | Fully built and shipping.                                   |
| 🟡 **New / Thin**     | Recently shipped; expect rough edges.                       |
| 🟠 **Stub / Partial** | Exists but incomplete.                                      |
| ⚫ **Unbuilt**        | Designed only — this whole module today.                    |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
| --- | --- | --- | --- |
| **Wardrobe catalog** (photo → cutout → tags → grid) | ⚫ Unbuilt | Design complete (Overview §5, §7). Image pipeline is ~80% template-clone from receipts/catalogue; net-new = `@imgly/background-removal` (client-side) + WebP/alpha compressor. | Phase 1 — OUT-1…OUT-6 |
| **Sizing profile** (height/weight/sizes/fit notes) | ⚫ Unbuilt | Own `wardrobe_profiles` table (not `user_preferences`); decimal inputs per Hard Rule 19. | Phase 1 — OUT-2, OUT-6 |
| **AI auto-tag** (Gemini vision → pre-filled tags) | ⚫ Unbuilt | Requires a small non-breaking `inlineData` widening in `src/lib/ai/gemini.ts`; manual tagging is the primary path, AI is an accelerator. | Phase 2 — OUT-7, OUT-8 |
| **Outfit builder** (2D paper doll, per-slot swipe) | ⚫ Unbuilt | `outfits` + `outfit_items` junction (denormalized `user_id`, one garment per slot). No precedent component in-repo — the `SlotSwiper` stack is the only truly novel UI. | Phase 3 — OUT-9…OUT-11 |
| **Weekly planner** (drag outfit → day) | ⚫ Unbuilt | Direct clone of `WebMealPlanCalendar.tsx` reduced to one slot/day; upsert-by-date. | Phase 4 — OUT-12, OUT-13 |
| **Wear / event log + no-repeat warning** | ⚫ Unbuilt | `outfit_plans` with `status='worn'` IS the log; reversible `set_outfit_plan_worn` RPC keeps Undo honest; amber banner on ≤14-day or same-event repeat. | Phase 4 — OUT-13, OUT-14 |

---

## Pain / gap ledger

- ⚫ Entire module is design-only as of 2026-07-17 — the ranked build queue is [4 · Checklist](<4 - Checklist.md>); no bugs can exist yet.

## Related code (single source of truth)

Do **not** duplicate file-path tables here. The authoritative design + (future) code map is [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>).

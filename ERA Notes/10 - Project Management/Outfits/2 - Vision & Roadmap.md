---
created: 2026-07-17
type: vision
status: living
owner: Elio
tags:
  - pm/vision
  - scope/module
  - module/outfits
---

# Outfits · 2 — Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** where Outfits is going — the locked v1 decisions, and the dream backlog beyond it. When a decision is realized, mark it `*(IMPLEMENTED YYYY-MM-DD)*` (Hard Rule 25).

---

## The vision

A game-style avatar screen for your real wardrobe: photograph clothes once, then compose, plan, and remember outfits forever. The functional payoff is **planning the week's outfits ahead** and **never repeating an outfit at consecutive events** — the app remembers what you wore to Sarah's wedding so you don't have to.

## Locked v1 decisions (owner-approved 2026-07-17 — see Overview §2 for full rationale)

- **D1 — 2D paper doll**, not 3D avatar, not AI-try-on-as-core. Cutouts stacked in slots; per-slot swipe.
- **D2 — Sizing profile only** (height/weight/sizes/fit notes); no body rendering.
- **D3 — V1 = catalog → builder → planner → wear log**, phased in that order.
- **D4 — Personal per user**; no household sharing (deliberate Hard-Rule-13 deviation).
- **D5 — Free tools; small images** (client WebP compression, on-device background removal, paths-not-base64, private bucket).
- **D6 — No offline write queue in v1.**

## Roadmap beyond v1 (dream backlog — one-liners, no commitments)

- **AI try-on** — photorealistic "me wearing this outfit" via Gemini image generation (or FASHN/ModelsLab free tiers); the app already holds the sizing profile + cutouts as inputs. The "cool" layer, deliberately deferred until the core loop is solid.
- **AI outfit suggestions** — "suggest an outfit for a smart-casual dinner, 24°C" from the tagged wardrobe.
- **Weather-aware planning** — planner surfaces the forecast per day and warns on season/formality mismatch.
- **Trips bridge** — generate a packing list from planned outfits for a trip's date range (Junction work — coordinate with Trips).
- **Multiple accessories per outfit** — drop the `UNIQUE(outfit_id, slot)` constraint for the `accessory` slot.
- **`fullbody` slot** — dresses/jumpsuits that occupy top+bottom simultaneously.
- **Cost-per-wear analytics** — link garments to purchase transactions; `price / times_worn` leaderboard (bridge to Budget).
- **ERA Hub integration** — "what should I wear today?" answered in Hub Chat from the day's plan.

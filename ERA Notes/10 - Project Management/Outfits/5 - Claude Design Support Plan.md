---
created: 2026-07-18
type: runbook
status: parked
owner: Elio
tags:
  - pm/runbook
  - module/outfits
  - scope/design
---

# Outfits · 5 — Claude Design Support Plan (on demand)

> **What this file is:** a ready-to-execute runbook for pulling **Claude Design** (design-system projects at claude.ai/design, synced via the `DesignSync` tool + `/design-sync` skill) into the Outfits UI work. Nothing here runs automatically — execute it only when the owner asks for visual iteration support. Parked until then.

## When to use it

Use Claude Design when you want to iterate on Outfits **visuals outside the app** — comparing variants as rendered cards before touching component code:

- Paper-doll proportions (row height ratios, overlay placement, doll frame treatment)
- `SlotSwiper` cell states (center / neighbor / none-cell, selection ring, parallax depth)
- Garment card styles for `WardrobeGrid` (label gradient, checkerboard treatment, archived look)
- Segmented control and chip families across the four themes (blue / pink / frost / calm)

Do NOT use it for behavior (scroll physics, decode-before-swap, haptics) — those only exist in the real app.

## Runbook

1. **Build a local card bundle** in `design-system/outfits/` (new dir, not shipped): one self-contained HTML file per card, first line `<!-- @dsCard group="Outfits" -->`. Inline all CSS; copy the real tokens (`--neo-card-*`, theme backgrounds) from `src/app/globals.css` so cards match the app per theme. Suggested cards: `segmented-control.html`, `garment-card.html`, `slot-swiper-states.html`, `paper-doll-frame.html`, `cutout-approve.html`.
2. **Pick the project**: `DesignSync list_projects` → reuse an existing design-system project or `create_project` ("ERA Design System").
3. **Sync**: `finalize_plan` (writes = `design-system/outfits/**`, localDir = repo root) → `write_files` with `localPath`s. Incremental, component-at-a-time — never wholesale replace.
4. **Iterate** in the claude.ai/design pane; when a variant wins, **port it back by hand** into `src/components/outfits/*` (the sync is one-way inspiration, not codegen), keeping `ui-guardrails` rules (theme classes, opaque panels, no hardcoded backgrounds).

## Ground rules

- The app repo stays the source of truth; Claude Design holds previews only.
- Cards must render both light/dark and ideally all four theme palettes side by side.
- Any visual decision that changes a component gets a normal PM trace (checklist item + Feature State stamp).

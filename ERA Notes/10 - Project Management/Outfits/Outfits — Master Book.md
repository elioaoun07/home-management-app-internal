---
created: 2026-07-17
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, 5 - Claude Design Support Plan (originals in ../_Archive/Outfits/)"
tags:
  - pm/master-book
  - scope/module
  - module/outfits
---

# Outfits — Master Book

> **Campaign:** Outfits · prefix `OUT` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

The wardrobe module: a garment catalog with on-device background-removed cutouts, a 2D paper-doll outfit builder, a weekly outfit planner, and a wear/event log with no-repeat warnings.

**A game-style avatar screen for your real wardrobe** — photograph clothes once, then compose, plan and remember outfits forever. The functional payoff is **planning the week's outfits ahead** and **never repeating an outfit at consecutive events**: the app remembers what you wore to Sarah's wedding so you don't have to.

**Source:** `src/features/outfits/`, `src/app/outfits/`, `src/components/outfits/`, `src/lib/{wardrobeImage,backgroundRemoval,motion}.ts`, `src/app/api/outfits/`. Migration: `migrations/2026-07-18_outfits-catalog-and-builder.sql`. **Implementation truth — read §10 (handover notes + STOP conditions) before writing any code:** [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>).

## Current State (verified)

Greenfield on 2026-07-17; the catalog and builder shipped together on 2026-07-18 as the Fable foundation session.

| Sub-feature | Tier | Reality | Next step |
|---|---|---|---|
| Wardrobe catalog (photo → cutout → tags → grid) | 🟡 | full loop shipped: capture → WebP compress (`wardrobeImage.ts`) → on-device cutout (`backgroundRemoval.ts`, lazy imgly) → approve / Keep-original → manual tags → private `wardrobe` bucket + batch signed URLs (50-min client cache) | phone acceptance test |
| Sizing profile (height/weight/sizes/fit notes) | 🟡 | `wardrobe_profiles` + `SizingProfileSheet` with decimal text inputs (Hard Rule 19), PUT upsert | — |
| Outfit builder (2D paper doll, per-slot swipe) | 🟡 | `SlotSwiper` = native CSS snap-scroll + framer scale/opacity parallax off one shared `scrollX` motion value (no re-renders during scroll), haptic tick on snap, reduced-motion safe. Shared spring presets live in **`src/lib/motion.ts`** — a new app-wide module, first consumer. Outerwear/accessory overlays crossfade behind a decode-before-swap guard. "Used in N outfits" warning wired in `GarmentDetailSheet` | phone acceptance; multi-accessory + `fullbody` slot stay backlog |
| AI auto-tag (Gemini vision → pre-filled tags) | ⚫ | needs a small non-breaking `inlineData` widening in `src/lib/ai/gemini.ts`; manual tagging is the primary path, AI is an accelerator. A disabled "Auto-tag — coming soon" affordance already sits where the button lands | OUT-7, OUT-8 |
| Weekly planner (drag outfit → day) | ⚫ | a direct clone of `WebMealPlanCalendar.tsx` reduced to one slot/day; upsert-by-date | OUT-12, OUT-13 |
| Wear / event log + no-repeat warning | ⚫ | `outfit_plans` with `status='worn'` **is** the log; a reversible `set_outfit_plan_worn` RPC keeps Undo honest; amber banner on a ≤14-day or same-event repeat | OUT-13, OUT-14 |

## Pain Inventory

- 🟠 **The migration has not been run.** `migrations/2026-07-18_outfits-catalog-and-builder.sql` must be executed manually in the Supabase SQL Editor — all `/api/outfits/*` routes 500 until then.
- 🟡 **Phone acceptance (D2) is still pending** — the photo → cutout → grid flow has not been verified on a real device, and the ~40 MB first-use model download UX needs a real-network test.
- 🟡 **Garment hard-delete Undo is partial by design** — Undo recreates the row (tags) but the photos are gone (storage removed server-side). The delete button warns first; archive is the soft path.
- ⚪ Outfit `PATCH` composition replacement is delete-then-insert (PostgREST has no cross-call transaction), so a mid-flight failure leaves the outfit empty until re-saved. Surfaced as an error so the user re-saves; low risk single-user.
- ⚪ **Server-side background removal is the clean end-state** but is not built — it would also fix the ~40–80 MB per-device model download and the on-device compute that caused the original "slow" complaint.

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

### Case study: the on-device cutout CSP chain (2026-07-19)

The real-phone D2 test surfaced `removeGarmentBackground` failing every retry. **Four stacked root causes**, each invisible in the thrown error:

1. onnxruntime-web's WASM backend does a nested dynamic `import()` of a `blob:` module, governed by CSP **`script-src`** (not `worker-src`) — silently blocked. Fixed by adding `blob:` + `'wasm-unsafe-eval'`.
2. `@imgly/background-removal`'s only WASM build **unconditionally** allocates `WebAssembly.Memory({shared: true})`, which needs `SharedArrayBuffer` and therefore cross-origin isolation. There is no non-shared-memory fallback build, so a JS-side thread-count workaround (tried, reverted) cannot work. `COOP: same-origin` was already set; added **`Cross-Origin-Embedder-Policy: credentialless`** (not `require-corp`, to avoid breaking Supabase Storage images and Google Fonts that lack CORP headers). Verified safe against Google Calendar OAuth first — that flow is a full-page redirect, so `window.opener` is never in play.
3. The ORT WASM loader wraps the fetched binary in a `blob:` URL and re-fetches it to feed the streaming compiler, governed by **`connect-src`** — added `blob:` there too.
4. Production then threw an `'unsafe-eval'` violation traced (by grepping the actual bundles) not to ORT but to imgly's bundled `ndarray` dep, which generates array accessors via `new Function(...)`. No flag or header avoids it. **Owner decision: accept `'unsafe-eval'`** — marginal added risk given `'unsafe-inline'` was already present and this is a personal household app.

**Lessons worth carrying:** the library needs FOUR CSP grants (`script-src` `blob:` + `'wasm-unsafe-eval'` + `'unsafe-eval'`, `connect-src` `blob:`) plus cross-origin isolation. Its thrown errors ("Failed to create session", "no available backend found", "Failed to fetch") are all generic — **the actual cause only appears in the browser's separate CSP-violation console lines.** On-device cutout is best-effort by design; if the CSP/isolation cost ever outweighs it, server-side is the clean exit.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Locked v1 decisions (owner-approved 2026-07-17 — full rationale in Overview §2)

- **D1 — 2D paper doll**, not a 3D avatar, not AI-try-on-as-core. Cutouts stacked in slots, per-slot swipe. *(IMPLEMENTED 2026-07-18)*
- **D2 — Sizing profile only** (height/weight/sizes/fit notes); no body rendering. *(IMPLEMENTED 2026-07-18)*
- **D3 — v1 = catalog → builder → planner → wear log**, phased in that order. *(AMENDED 2026-07-18 by owner: catalog + builder shipped together; AI-tag deferred behind them; planner unchanged as Phase 4)*
- **D4 — Personal per user**; no household sharing (a deliberate Hard-Rule-13 deviation).
- **D5 — Free tools, small images** — client WebP compression, on-device background removal, paths-not-base64, private bucket.
- **D6 — No offline write queue in v1.**

### The call

**Ship the catalog first; the paper doll is worthless until clothes are digitized.** The entire module hinges on one loop being pleasant: photo → cutout → tagged garment in under a minute. That loop carries all the infrastructure (bucket, pipeline, batch signed URLs). Everything after is composition and bookkeeping on clean data. **AI is deliberately an accelerator on manual tagging, never a dependency** — quota exhaustion must cost zero functionality. The planner is last because it is the most template-derived (a meal-plan clone) and needs outfits to exist.

### Dream backlog (no commitments)

- **AI try-on** — photorealistic "me wearing this outfit" via Gemini image generation; the app already holds the sizing profile + cutouts as inputs. The "cool" layer, deferred until the core loop is solid.
- **AI outfit suggestions** — "suggest an outfit for a smart-casual dinner, 24 °C" from the tagged wardrobe.
- **Weather-aware planning** — forecast per day, warn on season/formality mismatch.
- **Trips bridge** — generate a packing list from planned outfits for a trip's date range.
- **Multiple accessories per outfit** — drop the `UNIQUE(outfit_id, slot)` constraint for the accessory slot.
- **`fullbody` slot** — dresses/jumpsuits occupying top+bottom simultaneously.
- **Cost-per-wear analytics** — link garments to purchase transactions; `price / times_worn` leaderboard (bridge to Budget).
- **ERA Hub integration** — "what should I wear today?" answered from the day's plan.

### Claude Design support (parked runbook)

Use Claude Design only for **visuals outside the app** — paper-doll proportions, `SlotSwiper` cell states, garment card styles, segmented controls and chips across the four themes. **Never for behaviour** (scroll physics, decode-before-swap, haptics) — those only exist in the real app.

Runbook: build a local card bundle in `design-system/outfits/` (one self-contained HTML file per card, first line `<!-- @dsCard group="Outfits" -->`, inlined CSS copying the real tokens from `src/app/globals.css`) → `DesignSync list_projects` → `finalize_plan` (writes = `design-system/outfits/**`) → `write_files`, component-at-a-time, never wholesale. Iterate in the design pane, then **port the winner back by hand** into `src/components/outfits/*` — the sync is one-way inspiration, not codegen. The app repo stays the source of truth; any visual decision that changes a component gets a normal PM trace.

## Acceptance Criteria Index

### OUT-8
- **Acceptance:** auto-tag pre-fill works end-to-end into editable fields; a forced 429 shows the cooldown toast with manual tagging unaffected; a repo-wide typecheck proves no existing Gemini caller regressed.

### OUT-13
- **Acceptance:** dragging an outfit onto a day plans it; the "last worn" banner appears when applicable; a duplicate-date POST returns 409 and the client upserts.

### OUT-14
- **Acceptance:** mark-worn increments the outfit and item counters and Undo decrements them via `p_worn=false`.

## Successor Briefing

**STOP and re-read [Overview §10](<../../02 - Standalone Modules/Outfits/Overview.md>) if you are about to:** reuse `compressReceiptImage` for cutouts (JPEG flattens alpha) · top-level-import `@imgly/background-removal` · store base64 or signed URLs in DB columns · join `household_links` in any outfits route · write an EXISTS-subquery RLS policy · let AI write tags without user confirmation · call `tag-garment` without `timeoutMs: 60_000` · ship a toast without Undo.

**Definition of done for every phase:** `finish-task` clean (typecheck/lint), migration ↔ `schema.sql` paired, Atlas current, checklist ticked and this book's Shipped Log stamped.

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Design + implementation truth: [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>)
- Pre-consolidation originals: `../_Archive/Outfits/`

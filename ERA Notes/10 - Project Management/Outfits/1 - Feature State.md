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
| **Wardrobe catalog** (photo → cutout → tags → grid) | 🟡 New / Thin | ✅ 2026-07-18 (OUT-1…OUT-6). Full loop shipped: capture → WebP compress (`wardrobeImage.ts`) → on-device cutout (`backgroundRemoval.ts`, lazy imgly) → approve/Keep-original → manual tags → private `wardrobe` bucket + batch signed URLs (50-min client cache). Migration `2026-07-18_outfits-catalog-and-builder.sql` **must be run manually in Supabase before the routes work.** Not yet verified on a real phone (D2 acceptance pending). | Phone acceptance test; then Phase 2 |
| **Sizing profile** (height/weight/sizes/fit notes) | 🟡 New / Thin | ✅ 2026-07-18 (OUT-2, OUT-6). `wardrobe_profiles` + `SizingProfileSheet` (decimal text inputs per Hard Rule 19), PUT upsert. | — |
| **AI auto-tag** (Gemini vision → pre-filled tags) | ⚫ Unbuilt | Requires a small non-breaking `inlineData` widening in `src/lib/ai/gemini.ts`; manual tagging is the primary path, AI is an accelerator. A disabled "Auto-tag — coming soon" affordance already sits in `AddGarmentSheet` where the button lands. | Phase 2 — OUT-7, OUT-8 |
| **Outfit builder** (2D paper doll, per-slot swipe) | 🟡 New / Thin | ✅ 2026-07-18 (OUT-9…OUT-11). **Built ahead of Phase 2 by owner decision (2026-07-18)** — catalog + builder shipped together as the Fable foundation session; AI-tag deliberately deferred. `SlotSwiper` = native CSS snap-scroll + framer scale/opacity parallax off one shared `scrollX` motion value (no re-renders during scroll), haptic tick on snap, reduced-motion safe; shared spring presets in **`src/lib/motion.ts`** (new app-wide module, first consumer). Outerwear/accessory overlays crossfade behind a decode-before-swap guard. "Used in N outfits" warning wired in `GarmentDetailSheet`. | Phone acceptance; multi-accessory + `fullbody` slot stay backlog |
| **Weekly planner** (drag outfit → day) | ⚫ Unbuilt | Direct clone of `WebMealPlanCalendar.tsx` reduced to one slot/day; upsert-by-date. | Phase 4 — OUT-12, OUT-13 |
| **Wear / event log + no-repeat warning** | ⚫ Unbuilt | `outfit_plans` with `status='worn'` IS the log; reversible `set_outfit_plan_worn` RPC keeps Undo honest; amber banner on ≤14-day or same-event repeat. | Phase 4 — OUT-13, OUT-14 |

---

## Pain / gap ledger

- 🟠 **Migration not yet run** (2026-07-18): `migrations/2026-07-18_outfits-catalog-and-builder.sql` must be executed manually in the Supabase SQL Editor — all `/api/outfits/*` routes 500 until then. _(blocker until run)_
- ✅ **On-device background removal fixed — CSP + cross-origin isolation** (2026-07-19): real-phone D2 test surfaced `removeGarmentBackground` failing every retry, two stacked root causes. **Cause 1:** onnxruntime-web's WASM backend does a nested dynamic `import()` of a `blob:` module, governed by CSP `script-src` (not `worker-src`) — `next.config.ts` script-src was `'self' 'unsafe-inline'` only, so it was silently blocked. Fixed by adding `blob:` + `'wasm-unsafe-eval'` to `script-src`. **Cause 2:** `@imgly/background-removal`'s only WASM build unconditionally allocates `WebAssembly.Memory({shared: true})` (confirmed by reading the compiled glue code) — this needs `SharedArrayBuffer`, which requires the page to be cross-origin isolated (COOP+COEP). There is no non-shared-memory fallback build in this library, so a JS-side thread-count workaround (tried first, reverted) cannot work — isolation headers are the only fix. `COOP: same-origin` was already set; added `Cross-Origin-Embedder-Policy: credentialless` (not `require-corp`, to avoid breaking Supabase Storage images / Google Fonts that lack CORP headers). Verified safe against Google Calendar OAuth first — that flow is a full-page redirect (`/api/gcal/connect` → Google → `/api/gcal/callback`), not a popup, so `window.opener` isn't in play anywhere in the app. Diagnostic side-fix kept: `AddGarmentSheet.tsx` surfaces the real `err.message` in the amber banner if cutout ever fails again. Needs a real-phone retest to confirm the cutout now completes end-to-end.
- 🟡 **D2 phone acceptance pending** (2026-07-18): photo → cutout → grid flow not yet verified on a real device; the ~40 MB first-use model download UX needs a real-network test.
- 🟡 **Garment hard-delete Undo is partial by design** (2026-07-18): Undo recreates the row (tags) but photos are gone (storage removed server-side); the delete button warns first, archive is the soft path. Documented in Overview reality-delta terms here on purpose.
- Note: outfit `PATCH` composition replacement is delete-then-insert (PostgREST has no cross-call transaction); a mid-flight failure leaves the outfit empty until re-saved — surfaced as an error so the user re-saves. Low risk single-user; revisit only if it ever bites.

## Related code (single source of truth)

Do **not** duplicate file-path tables here. The authoritative design + (future) code map is [Outfits / Overview](<../../02 - Standalone Modules/Outfits/Overview.md>).

---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Outfits — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../../../../Outfits/Outfits — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Book delta

The complete Master Book and checklist were read. `git log --since=2026-07-30 --format="%h %ad %s" --date=short -- src/features/outfits src/components/outfits src/app/api/outfits src/lib/wardrobeImage.ts src/lib/backgroundRemoval.ts src/lib/ai/gemini.ts` returned no commits. Catalog and outfit builder exist; AI tagging, weekly planning and wear logging remain planned. The Feature Map's “What it does” includes the latter two, but `src/components/outfits/OutfitsPage.tsx` exposes the existing wardrobe/builder surfaces; treat the map as mixed intent and implementation.

The July 19 phone/CSP investigation in the book is evidence of real device debugging, not OUT-19's completed end-to-end acceptance. **UNVERIFIED:** current core migration and storage policies, full photo→cutout→tagged grid under a minute, first model-download cost. Resolve with E-00/OUT-19's owner-run acceptance and a fresh owner-generated `migrations/db-state.sql` export; never rerun a migration from a stale “not run” sentence.

The book acknowledges delete/reinsert composition risk and photo-destructive “Undo”; those are accurate source observations, not acceptable proof of reversibility. The promised ONE signed-URL request per screen has silently become a 100-path completeness limit (`src/features/outfits/useSignedUrls.ts:18–20`). The planned wear RPC is prose SQL, **not evidence of a deployed function**.

## Re-scored maturity

The Master Book has no dimension rubric. This is a provisional evidence rubric, not a fabricated historical comparison; 4.0/10 is the mean.

| Dimension | ASTRA /10 | What moves it +1 |
|---|---:|---|
| Catalog/image workflow | 6 | OUT-19 full phone witness, including first use |
| Save/delete integrity | 3 | Atomic composition and explicit reversible deletion contract |
| Image completeness | 4 | Every visible path resolves beyond 100; no per-image request fanout |
| Planning/wear payoff | 1 | Verified wear identity, retry and inverse before planner |
| Graceful AI dependency | 7 | Manual workflow remains complete when OUT-8 fails |
| Verification/operations | 3 | Executed regressions plus current owner storage/device evidence |

Evidence: API/hook findings below, checklist OUT-7/8/12–14/19, Overview §10. Scores are source-based; no device or DB behavior was exercised.

## Findings

1. **Saving metadata can succeed before validation; replacing composition can erase the old outfit on failure.** `src/app/api/outfits/[id]/route.ts:57–98` updates metadata, then validates ownership, then deletes composition and inserts its replacement. Invalid garments can leave changed metadata; insert failure can leave no composition. Creation has the same multi-write shape with a compensating delete whose result is unchecked (`src/app/api/outfits/route.ts:89–109`). “Save again” cannot reconstruct a composition the server discarded. **Priority: silent data loss / correctness.**
2. **The image cache hides a scalability failure as missing photos.** `src/features/outfits/useSignedUrls.ts:18–20` truncates the distinct sorted paths, including its cache key, at 100. `src/components/outfits/WardrobeGrid.tsx:46,105` requests and renders all filtered visible garments. With 101 distinct paths, one receives no URL even after refresh; this is not storage availability evidence. **Priority: silent incomplete results.** Bounded batches preserve the existing server cap without one request per image; changing the literal one-request acceptance needs an explicit owner amendment.
3. **The planned reversible wear function is neither retry-safe under concurrency nor a complete inverse.** The authored template at `ERA Notes/02 - Standalone Modules/Outfits/Overview.md:189–210` reads status without locking; two calls can both read “planned” and increment twice. Undo retains the newer `last_worn_at`, and uses the outfit's current composition rather than the garments worn at the event. A later edit can decrement different garments. These are defects in a proposed runbook, **not claims about live functions**. **Priority: correctness before new behavior.** CONFLICTS → OUT-12 “DDL verbatim” and Overview §4's accepted last-date approximation: the approximation now undermines the planned no-repeat decision itself.
4. **Garment Undo restores a new tag row, not the garment.** `src/app/api/outfits/items/[id]/route.ts:79–119` deletes the row then removes storage; `src/features/outfits/hooks.ts:242–278` recreates tags without ID or image paths. Existing outfit membership cannot be restored by that request. The book acknowledges missing photos but understates lost identity/composition. **Priority: recovery truth.** Archive is already the reversible path; do not add another “restored” promise without an inverse.
5. **AI is correctly an accelerator, while the practical payoff still lacks a reliable fact model.** OUT-7/8 remain unimplemented; `src/lib/ai/gemini.ts:70–71` is text-only. M-08 is conditional on OUT-19 and explicitly sacrificial. Building image reasoning before reliable saves and a wear fact would automate input into an unfinished loop. **Priority: owner effort / existing plan discipline.**

## Enhancement catalog

| Rank / ID | User-visible outcome | Size / severity | Mapping and dependency |
|---|---|---|---|
| 1 · ASTRA-OUT-1 | Saving an outfit preserves the previous complete outfit if validation or replacement fails. | M / friction | NEW — repairs an acknowledged write boundary; E-00 current core APPLIED evidence → atomic owner-scoped save |
| 2 · ASTRA-OUT-2 | Every garment on a large wardrobe screen receives an image URL without per-image fanout. | S / friction | CONFLICTS → OUT-19 and checklist D2's literal ONE batch; owner approves ≤100 paths per batch → tested batched signer |

Held refinements, not additional build sheets: **EXTENDS → OUT-12/14** with a locked, idempotent wear transition and historical membership/last-date contract; **CONFLICTS → Overview §4 / OUT-12** where the existing authored template defeats it. **EXTENDS → OUT-19** for device acceptance. **DOCKS → M-08** for optional AI tagging. **NEW** deletion-policy amendment: prefer existing archive for ordinary removal; owner must settle irreversible delete semantics before changing its controls. No silent replacement of the accepted hard-delete policy.

## What ERA needs from this module

- **Signals, held under OUT-12/14:** planned outfit for an upcoming event, actual prior wear at that event, unavailable garments. A mutable count plus approximate date is not an occurrence history.
- **Capabilities:** an owner-scoped read/open-outfit door can dock into E-04 after actual planner data exists. Manual tag fields are usable context; image URLs and full images do not belong in a persistent assistant context.
- **Missing data:** stable worn-plan identity, garments worn at the time, actual event/date and an inverse contract. Keep the planned `outfit_plans` source; first assess a membership snapshot/projection there rather than creating a second log.
- **Privacy:** D4 is personal per user, with no household linking. Cross-module schedule/trip suggestions must preserve that scope. No shared outfit feed inferred from household membership.

## Do not do

Do not move background removal to a service as a “cleanup”: D5 explicitly chooses free on-device processing. Do not implement AI try-on, redesign the paper doll, add household joins, introduce offline writes against D6, or widen Gemini types before the M-08 gate. Do not implement planner OUT-13 as one ASTRA packet: its L size must be split before dispatch. Do not persist signed URLs/base64 or add one signing request per image. Do not mistake a two-phone demo for validated save concurrency.

## Coverage note

Owns the Outfits standalone (wardrobe, builder and planned wear/planner), with the image pipeline as shared implementation support. Schedule owns event recurrence; Trips owns trip state; Budget owns purchase amounts. Proposed bridges use their contracts and do not move ownership into Outfits.

## ASTRA 10× Findings

- **Leverage 1:** Put both outfit save routes behind one atomic composition boundary; the same guarantee protects future planner references.
- **Leverage 2:** Remove the 100-path truncation while retaining bounded signing; completeness costs batches, not a new media system.
- **Simplification:** Treat worn plans as the source of wear statistics and event history, rather than letting counters become a second truth.
- **Frontier — EXTENDS → OUT-16/17, held:** An event-aware suggestion could reuse a confirmed wear history, schedule occasion and trip packing constraints with an editable proposal. The measurable win is fewer repeated-event outfits and fewer packing decisions; no new model or autonomous writes are required to establish the facts first.
- **Uncomfortable:** The “reversible” wear template was normalized before implementation, yet its concurrency check and inverse are insufficient even as written. Correcting the plan now is cheaper than repairing a wardrobe history later.


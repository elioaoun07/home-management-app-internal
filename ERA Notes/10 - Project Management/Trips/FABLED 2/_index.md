---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/trips
---

# Trips · FABLED 2 — Index

> Second-generation deep-dive, superseding [FABLED v1](<../FABLED/_index.md>) (2026-06-10). Re-verified against the working tree **2026-07-02**. The verdict is uncomfortable and worth stating plainly: **nothing that made Trips the riskiest module has changed** — cascades still never run end-to-end, RPC bodies still absent from the repo — while the modules it cascades *into* changed substantially in June. Risk compounds when the world moves and the unverified thing doesn't.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You need the X-ray plus what June changed *around* Trips (accounts semantics, schedule engine plans). |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | The ranked list — one gap still dominates, and its deadline argument is new. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | The unchanged, still-correct, still-unexecuted hardening path. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | The post-verification ladder + the "modes engine" generalization. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Design quality** | 8 | The `trip_side_effects` reversal ledger is genuinely good architecture — every cascade logged, completion walks it back. |
| **Verification** | 1 | Activate→complete has *never* been exercised deliberately; 5 weeks deferred-by-choice and counting. |
| **Repo recoverability** | 2 | `activate_trip`/`complete_trip` bodies: zero matches in the repo (grep 2026-07-02) — Schedule recovered its RPC; Trips didn't. |
| **Cross-module safety** | 3 | Pauses interact with an engine mid-unification; account creation duplicates logic whose semantics June changed. |
| **Test protection** | 0 | Nothing. |
| **Overall** | **2.8** | A well-designed machine nobody has ever switched on with witnesses present. |

## Delta since FABLED v1 — the headline

**In-module: zero movement.** G1 (verification) and G2 (RPC recovery) — v1's two 🔴s — are exactly where v1 left them.
**Around the module, three things raised the stakes:**
1. **Accounts semantics changed** (public/shared accounts, `visible` filters, RLS policy fix — June 26): the trip-account creation path *mirrors* accounts-route logic that no longer looks like it did when mirrored.
2. **Schedule Stage 2 is coming** ([Schedule FABLED 2.3 · O3](<../../Schedule/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)): pause handling will be consolidated into one engine — unverified pause-writing from Trips is about to interact with a rewritten reader.
3. **Repo precedent now exists**: `schema.sql` carries `get_schedule_bundle` + 13 policies, proving the recovery workflow works — which makes the missing trip RPCs a choice, not a limitation.

## The next 3 moves (identical to v1's, deliberately)

1. **O1 — recover the RPC bodies** (30 min in Supabase SQL Editor → snapshot migration).
2. **O2 — run the G1 verification round-trips** (one focused session; the checklist is written).
3. **O3 — commit the ledger-symmetry assertion** and run it after every future cascade change.

If these don't fit this month either, [file 2 · G8](<2 - FABLED 2 — Gaps & Missing.md>) names the honest fallback: freeze the module in writing.

**Sibling deep-dives:** [Budget](<../../Budget/FABLED 2/_index.md>) · [Schedule](<../../Schedule/FABLED 2/_index.md>) · [Kitchen](<../../Kitchen/FABLED 2/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 2/_index.md>) · [Notifications & Alerts](<../../Notifications & Alerts/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)

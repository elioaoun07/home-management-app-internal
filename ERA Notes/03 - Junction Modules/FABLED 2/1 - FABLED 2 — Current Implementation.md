---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/junction
---

# Junction Modules · FABLED 2.1 — The Bridge Matrix

> **FABLED 2:** [_index](<_index.md>) · **1 · Matrix** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Every cross-module bridge, verified 2026-07-02. Direction matters: → is one-way, ↔ is a closed loop. The app's thesis is that ↔ beats →.

---

## 1 · Bridges that exist

| Bridge | Dir | State | Note |
|---|---|---|---|
| Hub message → transaction / reminder / item | → | ✅ mature | Message Actions; bulk convert added the reviewed-draft lane (06-16) |
| Voice → budget draft → confirm | ↔ | ✅ mature | the drafts loop closes |
| Recipe / meal plan → shopping list | → | ✅ | Kitchen's built half |
| Inventory → shopping (manual) | → | ✅ | the auto half missing (keystone) |
| Trips → schedule/chores/meals/budget | → | ⚠️ built, **unverified** | reversal ledger never exercised |
| Household links → every read path | → | ✅ pervasive | HR 13; June's RLS fix hardened accounts |
| Notifications ← items/recurring/budget | ← | ✅ | routing fixed 06-19; policy layer absent |
| Sync/offline ← all mutations | ← | ◐ | IndexedDB queue solid; 240 raw `fetch(` bypass it |
| Prerequisites: NFC → item unlock | → | ✅ narrow | 4 evaluators still stubs |
| Catalogue templates → items | → | ✅ | promote/from-template |
| Plan My Day ↔ items/day_plans | ↔ | ✅ new | June; `intent` captured-unread |

## 2 · Bridges decided but unbuilt (the fact-duplication list)

Recurring due ↔ Schedule occurrence · Debt collection → reminder · Future purchase ↔ transaction completion · Low-stock → shopping proposal · Meals → time surfaces · Week-shape → ERA. All six have owners and seams in the campaign FABLED 2 file 4s; none started. These are the "one fact, two records" holes the FAR's junction-leverage chapter is about.

## 3 · The missing center

Each junction connects **two** modules. Nothing connects **all of them to the user proactively** — that's the signals → composer → policy → delivery spine ([FAR FABLED 2.3](<../../10 - Project Management/Functional Architecture Review/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)). June manufactured its parts in separate modules without assembling them; the assembly is the junction layer's whole next chapter.

## 4 · Junction-layer test truth

Cross-module behavior has **zero automated coverage** anywhere: no household-expansion test, no message-action→record test, no cascade test, no offline-replay-across-modules test. Every junction bug ships to production and waits for a human to notice — the June cron household bug (both-phones fix) is the type specimen: silent for weeks, found by lived experience.

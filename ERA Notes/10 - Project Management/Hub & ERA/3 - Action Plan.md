---
created: 2026-05-30
updated: 2026-06-20
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/hub-era
---

# Hub & ERA · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why, and in what order* for Hub & ERA — the strategic call and the candidate work as narrative. The flat, checkable version of this plan is [4 · Checklist](<4 - Checklist.md>); tick the boxes there.

---

## 📌 The call

**This period: harden the flagship, then make it anticipate.**

Hub Chat is 🟢 Core but ERA and Voice — your *signature* features — are 🟡 New/Thin with **no tests** and external-dependency fragility. The danger here isn't missing features; it's that the most differentiated work is the least protected, and a confidently-wrong assistant erodes trust faster than a quiet one. Lock intent routing and voice degradation first, then make ERA read the full time + money graph so it's visibly smarter.

This mirrors the global theme ("Stabilize, then Connect") — and ERA is where "Connect" pays off most, because it's the *receiving end* of the best bridges in the Schedule and Budget folders.

---

## 🎯 Candidate work (from [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>))

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| Intent-routing tests + fallback | A | High | M | ✅ yes |
| Voice graceful degradation + setup docs | A | High | M | ✅ yes |
| Briefing enrichment ← Schedule | B | High | M | — |
| Briefing enrichment ← Budget (cashflow) | B | High | M | — |
| Decompose `HubPage.tsx` (5,506 LOC) | A | High | M–H | — |
| Expense-split from chat | B | Med | M | — |
| Richer faces / widgets | A | Med | M | — |
| Smart notification timing + digest | B | Med | M | — |

---

## 🗺️ The sequence (narrative)

**Now — Harden the flagship.** Cover the common intents and make a misrecognized intent fail *safe* (clarify, never confidently mis-act); add voice graceful degradation + wake-word setup docs. The signature feature should never confidently do the wrong thing.

**Next — Make ERA anticipate.** Feed the week's shape into ERA's proactive briefing (coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>)) and warn before a recurring payment overdraws (coordinate with [Budget · 3 · Action Plan](<../Budget/3 - Action Plan.md>)).

**Later — Pay down structural risk.** Decompose `HubPage.tsx` (5,506 LOC) — best done *as* the substrate for in-chat briefings, so the refactor buys a feature.

→ Every item above as a checkable line: [4 · Checklist](<4 - Checklist.md>).

---

## 🚫 Not now

- ❌ Don't pile proactive features onto an untested intent router — harden routing first.
- ❌ Don't decompose `HubPage.tsx` "just because" — do it *with* the briefing work so the refactor delivers a feature.
- ❌ Don't add new Voice features before graceful degradation exists — environmental failures will dominate the experience otherwise.

---

## ⏭️ Later / backlog

- Expense-split from chat (gap 8a).
- Richer in-chat faces / widgets (balance, today, low-stock) with fresh cache.
- Smart notification timing + quiet hours + weekly digest. _(global Track B 7a/7b)_
- Kitchen → ERA food nudges; Trips → ERA re-entry briefing (receiving ends of those folders' bridges).

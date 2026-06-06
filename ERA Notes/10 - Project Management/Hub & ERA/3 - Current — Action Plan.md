---
created: 2026-05-30
updated: 2026-05-30
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/hub-era
---

# Hub & ERA · 3 — Current — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the living queue of what to actually do next on Hub & ERA — **might be this week, might be later.** Not a fixed Mon–Fri grid. Re-order as priorities move; promote an item to "Now" when you pick it up.

---

## 📌 The call

**This period: harden the flagship, then make it anticipate.**

Hub Chat is 🟢 Core but ERA and Voice — your *signature* features — are 🟡 New/Thin with **no tests** and external-dependency fragility. The danger here isn't missing features; it's that the most differentiated work is the least protected, and a confidently-wrong assistant erodes trust faster than a quiet one. Lock intent routing and voice degradation first, then make ERA read the full time + money graph so it's visibly smarter.

This mirrors the global theme ("Stabilize, then Connect") — and ERA is where "Connect" pays off most, because it's the *receiving end* of the best bridges in the Schedule and Budget folders.

---

## 🎯 Candidate work (from [2 · Future Vision](<2 - Future Vision & Roadmap.md>))

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

## 🗓️ Sequenced plan

### Now — Harden the flagship (do first)

- [ ] **Intent-routing tests + graceful fallback.** Cover the common intents and ensure a misrecognized intent fails *safe* (asks/clarifies) rather than firing a wrong action. The signature feature should never confidently do the wrong thing.
- [ ] **Voice graceful degradation + setup docs.** When Azure STT/TTS/wake is unavailable, degrade clearly instead of breaking; document the wake-word external setup (still required per memory). Add degradation tests.

### Next — Make ERA anticipate

- [ ] **Briefing enrichment ← Schedule.** Feed the whole week's shape into ERA's proactive briefing. Coordinate with [Schedule · 3](<../Schedule/3 - Current — Action Plan.md>) (same bridge, other end). _(global Track B)_
- [ ] **Briefing enrichment ← Budget (cashflow).** Warn before a recurring payment overdraws. Coordinate with [Budget · 3](<../Budget/3 - Current — Action Plan.md>). _(global Track B)_

### Later — Pay down structural risk

- [ ] **Decompose `HubPage.tsx`** (5,506 LOC) — best done as the substrate for in-chat briefings, so the refactor buys a feature.

---

## ✅ Definition of done — this period

- [ ] Intent routing has test coverage; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.
- [ ] Voice degrades gracefully with no Azure connection, and the setup is documented.
- [ ] ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only).
- [ ] File 1 (Feature State) updated to drop the "no tests" / "fragile" notes this work closes.

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

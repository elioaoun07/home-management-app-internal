---
created: 2026-06-20
updated: 2026-06-20
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/hub-era
---

# Hub & ERA · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Hub & ERA — every actionable item as one checkbox, grouped **Now / Next / Later**, each with an ID, severity, and effort. The narrative *why* is [3 · Action Plan](<3 - Action Plan.md>). ✅ items stay as the record (Hard Rule #25 — no orphan fixes).
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. Point at a line (e.g. _N1_), a group, or a phase.

---

## ▶️ Now — Harden the flagship

- [ ] **N1** Intent-routing tests + graceful fallback — cover the common intents; a misrecognized intent clarifies instead of firing a wrong action. _(🔴 · M)_
- [ ] **N2** Voice graceful degradation + setup docs — when Azure STT/TTS/wake is unavailable, degrade clearly; document the wake-word external setup (still required per memory); add degradation tests. _(🔴 · M)_

## ⏭️ Next — Make ERA anticipate

- [ ] **X1** Briefing enrichment ← Schedule — feed the whole week's shape into ERA's proactive briefing. Coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>). _(🟠 · M)_
- [ ] **X2** Briefing enrichment ← Budget (cashflow) — warn before a recurring payment overdraws. Coordinate with [Budget · 3 · Action Plan](<../Budget/3 - Action Plan.md>). _(🟠 · M)_

## 🔜 Later — Pay down structural risk + reach

- [ ] **L1** Decompose `HubPage.tsx` (5,506 LOC) — best done as the substrate for in-chat briefings, so the refactor buys a feature. _(🟠 · M–H)_
- [ ] **L2** Expense-split from chat (gap 8a). _(🟡 · M)_
- [ ] **L3** Richer in-chat faces / widgets (balance, today, low-stock) with fresh cache. _(🟡 · M)_
- [ ] **L4** Smart notification timing + quiet hours + weekly digest. _(🟡 · M)_
- [ ] **L5** Kitchen → ERA food nudges; Trips → ERA re-entry briefing (receiving ends of those folders' bridges). _(🟡 · M)_

---

## ✅ Definition of done — this period

- [ ] **D1** Intent routing has test coverage; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.
- [ ] **D2** Voice degrades gracefully with no Azure connection, and the setup is documented.
- [ ] **D3** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only).
- [ ] **D4** [1 · Feature State](<1 - Feature State.md>) updated to drop the "no tests" / "fragile" notes this work closes.

## ✅ Completed fixes log

- [x] **2026-07-10 — H1:** enforce private/public notification boundaries in immediate and fallback Hub delivery. _(🔴 privacy · S)_
- [x] **2026-07-10 — H2:** make shopping-item dots receipt-backed unread markers that clear on open and reappear for the next partner reply. _(🟠 friction · M)_

---
created: 2026-06-20
updated: 2026-07-15
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
> **What this file is:** the single flat, checkable surface for Hub & ERA — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [3 · Action Plan](<3 - Action Plan.md>). Completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** N1–N2→HUB-1–HUB-2, X1–X2→HUB-3–HUB-4, L1–L6→HUB-5–HUB-10.

---

## Now

- [ ] **HUB-1** Intent-routing tests + graceful fallback — cover the common intents; a misrecognized intent clarifies instead of firing a wrong action. _(blocker - M)_
- [ ] **HUB-2** Voice graceful degradation + setup docs — when Azure STT/TTS/wake is unavailable, degrade clearly; document the wake-word external setup (still required per memory); add degradation tests. _(blocker - M)_

## Next

- [ ] **HUB-3** Briefing enrichment ← Schedule — feed the whole week's shape into ERA's proactive briefing. Coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>). _(friction - M)_
- [ ] **HUB-4** Briefing enrichment ← Budget (cashflow) — warn before a recurring payment overdraws. Coordinate with [Budget · 3 · Action Plan](<../Budget/3 - Action Plan.md>). _(friction - M)_

## Later

- [ ] **HUB-5** Decompose `HubPage.tsx` (5,506 LOC) — best done as the substrate for in-chat briefings, so the refactor buys a feature. _(friction - L)_
- [ ] **HUB-6** Expense-split from chat (gap 8a). _(annoyance - M)_
- [ ] **HUB-7** Richer in-chat faces / widgets (balance, today, low-stock) with fresh cache. _(annoyance - M)_
- [ ] **HUB-8** Smart notification timing + quiet hours + weekly digest. _(annoyance - M)_
- [ ] **HUB-9** Kitchen → ERA food nudges; Trips → ERA re-entry briefing (receiving ends of those folders' bridges). _(annoyance - M)_
- [ ] **HUB-10** Merchant-match in "Add as Transaction" — when a chat message is converted to a transaction (Message Actions), run its text through the shared merchant map (shipped 2026-07-11 for the expense form) to pre-select Category/Subcategory. Counterpart of [Budget · 4 · Checklist](<../Budget/4 - Checklist.md>) BUD-2. _(annoyance - M)_

## Definition of Done

- [ ] **D1** Intent routing has test coverage; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.
- [ ] **D2** Voice degrades gracefully with no Azure connection, and the setup is documented.
- [ ] **D3** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only).
- [ ] **D4** [1 · Feature State](<1 - Feature State.md>) updated to drop the "no tests" / "fragile" notes this work closes.

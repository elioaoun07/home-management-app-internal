---
created: 2026-05-30
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/hub-era
---

# Hub & ERA · 2 — Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *ambitious* Hub & ERA file — where the flagship could go. Enhancements to what exists **and** richer connections to the rest of the app. This is allowed to dream; [1 · Feature State](<1 - Feature State.md>) is the sober reality. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

---

## The strategic thesis

Hub & ERA is the app's **brain and front door** — the interaction model says the Hub is the top-layer primary interface, where low-friction everyday actions happen, and ERA is the assistant living inside it. Today the Hub is an excellent *reactive* surface: you talk, it parses, it acts. Its untapped value is the proactive half:

1. **ERA is only as smart as the graphs it reads.** Schedule (time) and Budget (money) are the two spines; ERA today barely reads them proactively. The moat isn't a better chat box — it's an assistant that *knows the household* and speaks first, correctly, at the right moment.
2. **Reactive parsing is largely solved; proactive intelligence is the frontier.** The differentiation — and the risk — both live in the proactive briefings and the cross-module reads behind them.

**The vision in one line:** *Turn ERA from a chat box that answers into a household brain that anticipates — reading the full time + money graph and speaking first, at the right moment, with the right context.*

---

## Track A — Internal enhancements (within the module)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Harden intent routing** | Intent router works, untested | Test coverage + graceful fallback for misrecognized intents (no silent wrong action) | M |
| **Decompose `HubPage.tsx`** | 5,506 LOC single file | Split into testable units so Hub changes stop being high-risk | M–H |
| **Voice graceful degradation** | Azure-dependent; fails environmentally | Clear fallback when STT/TTS/wake unavailable; setup docs; degradation tests | M |
| **Richer faces / widgets** | Faces + inline widgets exist | More module widgets in-chat (balance, today, low-stock) with fresh cache | M |
| **Expense-split from chat** | Message → transaction | Split a bill conversationally in the Hub (gap 8a) | M |

---

## Track B — Bridges out of Hub & ERA (cross-module)

ERA is *defined* by its reads into other modules. Each ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>) — and most are the *receiving end* of bridges the other module folders propose.

- **ERA ← Schedule (briefing enrichment).** Read the whole week's shape — recurring due, overdue routines, household-assigned items by person. *(global Track B; mirror of [Schedule · 2](<../Schedule/2 - Vision & Roadmap.md>))*
- **ERA ← Budget (cashflow awareness).** Warn before a recurring payment overdraws; surface overspend. *(mirror of [Budget · 2](<../Budget/2 - Vision & Roadmap.md>))*
- **ERA ← Kitchen.** "Low on 3 staples, nothing planned Thursday." *(mirror of [Kitchen · 2](<../Kitchen/2 - Vision & Roadmap.md>))*
- **ERA ← Trips.** Re-entry briefing: "you're back tomorrow — N chores/routines resume." *(mirror of [Trips · 2](<../Trips/2 - Vision & Roadmap.md>))*
- **Smart notification timing.** Quiet hours + weekly digest instead of daily noise, driven from ERA's read of what actually matters. *(global Track B · weekly digest 7a/7b)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Harden intent routing (A)        Briefing enrichment ← Schedule (B)
   │  Voice graceful degradation (A)   Cashflow-aware ERA ← Budget (B)
   │                                   Decompose HubPage.tsx (A)
   ├──────────────────────────────────────────────────────────
M  │  Expense-split from chat (B)      Richer faces/widgets (A)
   │  Smart notif timing (B)           Kitchen/Trips → ERA reads (B)
   │
   ├──────────────────────────────────────────────────────────
L  │  (—)                              (—)
   │
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Hub & ERA:

1. **Bet 1 — Harden the flagship: intent-routing tests + voice graceful degradation.** The signature features are the least protected; a wrong intent or an Azure outage with no fallback is the most damaging failure to the product's identity. Lock this before adding proactive reach.
2. **Bet 2 — Briefing enrichment ← Schedule + Budget.** The biggest *felt* upgrade and the moat: ERA visibly smarter because it reads the full time + money graph. This is the receiving end of the top bridges in the Schedule and Budget folders — coordinate so both ends ship together.
3. **Bet 3 — Decompose `HubPage.tsx`.** Pay down the 5,506-LOC risk before it blocks every future Hub feature. Best done as the substrate for Bet 2's in-chat briefings.

> Resist piling proactive features onto an untested intent router — a confidently-wrong assistant erodes trust faster than a quiet one. Harden, then anticipate.

→ This period's concrete actions: [3 · Action Plan](<3 - Action Plan.md>); the checkable list: [4 · Checklist](<4 - Checklist.md>).

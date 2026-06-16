---
created: 2026-05-30
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/schedule
---

# Schedule · 2 — Future Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the *ambitious* Schedule file — where the module could go. Enhancements to what exists **and** richer connections to the rest of the app. This is allowed to dream; [1 · Feature State](<1 - Feature State — Current Reality.md>) is the sober reality. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

---

## The strategic thesis

Schedule is the household's **time graph** — every dated obligation (reminders, events, recurring chores, flexible routines, payment due-dates) lives here. Today it is a strong *reactive* surface: you put things in, it shows them back on a calendar. Its untapped value is twofold:

1. **It is the spine ERA should read from.** The proactive assistant's briefings are only as smart as the time graph behind them. Enriching Schedule directly upgrades ERA.
2. **It already touches money, chores, and trips** — but mostly one-directionally. The biggest wins are tightening those connections so a due-date in Schedule and a payment in Budget are the *same fact*.

**The vision in one line:** *Turn Schedule from a calendar you read into a time graph that acts — surfacing the right item, at the right time, with the right context, before you go looking.*

---

## Track A — Internal enhancements (within the module)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Finish Prerequisites evaluators** | NFC→item works; `time_window` / `schedule` / `custom_formula` / `weather` are stubs | `time_window` ("show meds 7–9am"), `schedule` ("after gym → log meal"), `custom_formula` — *conditional automation*, rare and powerful | M (per evaluator; `time_window` is S) |
| **Recurrence editor UX** | RRULE built via `CustomRecurrencePicker`; edits of a single occurrence vs the series are subtle | Clear "this / this-and-future / all" choice on every edit & delete, matching calendar-app expectations | M |
| **Bulk occurrence operations** | One-at-a-time complete/postpone/skip | Multi-select across the list/calendar → bulk complete / postpone / reschedule | M |
| **Smarter overdue handling** | Flexible overdue look-back ≤3 periods; fixed items just sit overdue | Roll-forward suggestions ("you missed Tue's workout — slot it Thu?"), and a single overdue triage view | M |
| **Natural-language item entry** | Quick form has smart text parsing | Full NL: "every other Thursday at 7", "remind me 2 days before rent" — parsed into rrule + alert in one line | M |
| **Test the placement rule** | Enforced by convention across 6+ views | One guard test so flexible items can never silently land on the activation day | S |
| **Plan My Day (disrupted-day planner)** | *(IMPLEMENTED 2026-06-16)* `/today` triage page — one-time/recurring/flexible items landing on a day, push off, both-direction prepone for flexible items, ad-hoc tasks, checkpoints, persisted via `day_plans`. *(FIXED 2026-06-16 same day)* save-gated draft model (edit form + Save vs. read-only preview card + Edit/Delete) replaced the original auto-save-per-keystroke header. | Hourly timeline canvas (drag items into time slots) + mood/energy "rest vs productivity" optimizer reading `day_plans.intent` | M (timeline) / M–H (optimizer) |

---

## Track B — Bridges out of Schedule (cross-module)

These connect Schedule to the rest of the household graph. Each ladders up to a track in the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Schedule → Focus / ERA briefing enrichment.** The Focus briefing pulls Schedule items but could pull *the whole week's shape* — recurring due, overdue routines, household-assigned items by person. *(global Track B · briefing enrichment)*
- **Schedule ↔ Budget (due-dated payments).** A recurring payment's due-date and a Schedule reminder are often the same intent — unify them so confirming a payment closes the reminder and vice versa. *(global Track A · Recurring→Budget; Track C · Cashflow Forecast)*
- **Schedule ↔ Notifications (smart timing).** Alerts fire at fixed offsets today. Smart timing + quiet hours (no 2am pings) + a weekly digest instead of daily noise. *(global Track B · weekly digest 7a/7b)*
- **Trips → Schedule cascade.** Trip activation/completion already fires schedule side-effects; make the cascade legible and verifiable from the Schedule side (which items a trip created/closed). *(global Trips row)*
- **Debt → Schedule.** Auto-create a reminder on a debt's collection date. *(global Track A · Debt→Reminder 2e)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Briefing enrichment (B)        Schedule↔Budget unify (B)
   │  time_window prereq (A)         Natural-language entry (A)
   │  Placement-rule test (A)        Cashflow tie-in (B/global C1)
   ├──────────────────────────────────────────────────────────
M  │  Smart alert timing (B)         Recurrence edit UX (A)
   │  Debt→Schedule (B)              Bulk occurrence ops (A)
   │  Smarter overdue (A)            schedule/custom_formula prereq (A)
   ├──────────────────────────────────────────────────────────
L  │  (—)                            weather prereq (A)
   │                                 Trips cascade visibility (B)
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Schedule:

1. **Bet 1 — Lock the foundation: placement-rule test + recurrence/occurrence unit tests.** Low effort, kills the highest-risk gaps from file 1. Do this before any enhancement that touches views.
2. **Bet 2 — Ship `time_window` prerequisite.** Smallest of the four stubs, highest demo value (meds/morning windows), and it proves out the conditional-automation engine.
3. **Bet 3 — Schedule → briefing enrichment.** The biggest *felt* upgrade: it makes ERA visibly smarter by reading the full time graph. Ladders straight into the global moat (Track B).

> Resist starting bridges before the foundation tests exist — the recurrence math is exactly where a silent bridge bug would hide.

→ This period's concrete actions: [3 · Current Action Plan](<3 - Current — Action Plan.md>).
